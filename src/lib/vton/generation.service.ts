import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import imageSize from 'image-size';

import type { Database } from '../../db/database.types.ts';
import type {
  GarmentAssetMetadata,
  GarmentValidationResult,
  GenerationCreateCommand,
  GenerationQueuedResponseDto,
  ImageValidationConstraints,
  StoredGarmentSnapshot,
  FreeQuotaSnapshot,
  VtonEnvironmentConfig,
} from '../../types.ts';
import { createLogger, type Logger } from '../logger.ts';

type Supabase = SupabaseClient<Database>;

export interface GenerationServiceContext {
  userId: string;
  supabase: Supabase;
  env: VtonEnvironmentConfig;
  vertexClient: VertexClient;
  logger?: Logger;
  now?: () => Date;
  idFactory?: () => string;
}

export interface VertexClient {
  enqueueJob(input: VertexEnqueueInput): Promise<VertexEnqueueResult>;
}

export interface VertexEnqueueInput {
  generationId: string;
  userId: string;
  personaPath: string;
  garmentPath: string;
  retainForHours: number;
}

export interface VertexEnqueueResult {
  jobId: string;
  etaSeconds?: number;
}

export class GenerationServiceError extends Error {
  constructor(
    message: string,
    public readonly options: {
      code: GenerationServiceErrorCode;
      httpStatus: number;
      cause?: unknown;
      context?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'GenerationServiceError';
  }
}

export type GenerationServiceErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'consent_mismatch'
  | 'persona_missing'
  | 'quota_exhausted'
  | 'profile_not_found'
  | 'storage_failure'
  | 'vertex_failure'
  | 'database_failure';

const RETAIN_HOURS_MIN = 24;
const RETAIN_HOURS_MAX = 72;

export async function createGeneration(
  command: GenerationCreateCommand,
  context: GenerationServiceContext,
): Promise<GenerationQueuedResponseDto> {
  const logger = context.logger ?? createLogger({ name: 'generation-service' });
  const now = context.now?.() ?? new Date();
  const generationId = context.idFactory?.() ?? randomUUID();

  if (!command) {
    throw new GenerationServiceError('Generation command payload is required.', {
      code: 'invalid_request',
      httpStatus: 400,
    });
  }

  if (!(command.garment instanceof Blob)) {
    throw new GenerationServiceError('Garment payload must be provided as a file upload.', {
      code: 'invalid_request',
      httpStatus: 400,
    });
  }

  if (!command.garmentFilename) {
    throw new GenerationServiceError('Garment filename is required.', {
      code: 'invalid_request',
      httpStatus: 400,
    });
  }

  const retainForHours = normalizeRetention(command.retainForHours);

  const profile = await fetchProfile(context, logger);

  if (!profile) {
    throw new GenerationServiceError('User profile is required before generating outfits.', {
      code: 'profile_not_found',
      httpStatus: 404,
    });
  }

  if (profile.consent_version !== command.consentVersion) {
    logger.warn('Consent version mismatch detected.', {
      expected: profile.consent_version,
      received: command.consentVersion,
      userId: context.userId,
    });

    throw new GenerationServiceError('Consent version must be refreshed before requesting VTON.', {
      code: 'consent_mismatch',
      httpStatus: 403,
    });
  }

  if (!profile.persona_path) {
    throw new GenerationServiceError('Persona asset must be uploaded before generating outfits.', {
      code: 'persona_missing',
      httpStatus: 403,
    });
  }

  const quotaSnapshot = ensureQuota(profile);

  const garmentValidation = await validateGarment(command.garment, {
    minWidth: context.env.minGarmentWidth,
    minHeight: context.env.minGarmentHeight,
    maxBytes: context.env.maxGarmentBytes,
    allowedMimeTypes: context.env.allowedGarmentMimeTypes,
  });

  if (!garmentValidation.ok) {
    throw new GenerationServiceError(garmentValidation.message, {
      code: 'invalid_request',
      httpStatus: 400,
      context: {
        reason: garmentValidation.code,
        details: garmentValidation.details,
      },
    });
  }

  const garmentSnapshot = await persistGarment({
    command,
    metadata: garmentValidation.metadata,
    context,
    generationId,
    now,
    logger,
  });

  const personaSnapshotPath = await snapshotPersona(profile.persona_path, context, generationId, logger);

  const expiresAt = new Date(now.getTime() + retainForHours * 60 * 60 * 1000).toISOString();

  const generationRow = await insertGenerationRecord({
    context,
    generationId,
    personaSnapshotPath,
    garmentSnapshotPath: garmentSnapshot.path,
    expiresAt,
    now,
    logger,
  });

  await updateProfileClothCache(profile, garmentSnapshot, retainForHours, context, logger);

  const vertexResult = await enqueueVertexJob({
    context,
    generationId,
    personaSnapshotPath,
    garmentSnapshotPath: garmentSnapshot.path,
    retainForHours,
    logger,
  });

  await setGenerationVertexId(context, generationId, vertexResult.jobId, logger);

  return {
    id: generationId,
    status: generationRow.status,
    vertexJobId: vertexResult.jobId,
    etaSeconds: vertexResult.etaSeconds ?? context.env.defaultEtaSeconds,
    quota: {
      remainingFree: Math.max(quotaSnapshot.remaining - 1, 0),
    },
    createdAt: generationRow.created_at,
    personaSnapshotPath,
    clothSnapshotPath: garmentSnapshot.path,
    expiresAt: generationRow.expires_at,
  };
}

function normalizeRetention(retainForHours?: number): number {
  if (retainForHours === undefined || retainForHours === null) {
    return 48;
  }

  if (!Number.isInteger(retainForHours)) {
    throw new GenerationServiceError('Retention must be provided as an integer value.', {
      code: 'invalid_request',
      httpStatus: 400,
      context: { value: retainForHours },
    });
  }

  if (retainForHours < RETAIN_HOURS_MIN || retainForHours > RETAIN_HOURS_MAX) {
    throw new GenerationServiceError(
      `Retention duration must be between ${RETAIN_HOURS_MIN} and ${RETAIN_HOURS_MAX} hours.`,
      {
        code: 'invalid_request',
        httpStatus: 400,
        context: { value: retainForHours },
      },
    );
  }

  return retainForHours;
}

async function fetchProfile(context: GenerationServiceContext, logger: Logger) {
  const { supabase, userId } = context;

  const { data, error, status } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load profile for generation.', {
      userId,
      status,
      code: error.code,
      error: error.message,
    });

    throw new GenerationServiceError('Unable to load profile for generation.', {
      code: 'database_failure',
      httpStatus: 500,
      cause: error,
    });
  }

  return data;
}

export function ensureQuota(profile: Database['public']['Tables']['profiles']['Row']): FreeQuotaSnapshot {
  const remaining = Math.max(profile.free_generation_quota - profile.free_generation_used, 0);

  if (remaining <= 0) {
    throw new GenerationServiceError('Free generation quota exhausted for this account.', {
      code: 'quota_exhausted',
      httpStatus: 429,
      context: { userId: profile.user_id },
    });
  }

  return {
    total: profile.free_generation_quota,
    used: profile.free_generation_used,
    remaining,
    renewsAt: profile.quota_renewal_at,
  };
}

export async function validateGarment(
  garment: Blob,
  constraints: ImageValidationConstraints,
): Promise<GarmentValidationResult> {
  if (!garment.size) {
    return {
      ok: false,
      code: 'missing_file',
      message: 'Garment file is required.',
    };
  }

  const mimeType = garment.type;
  if (!constraints.allowedMimeTypes.includes(mimeType)) {
    return {
      ok: false,
      code: 'unsupported_mime',
      message: `Garment must be one of: ${constraints.allowedMimeTypes.join(', ')}.`,
      details: { mimeType },
    };
  }

  if (garment.size > constraints.maxBytes) {
    return {
      ok: false,
      code: 'exceeds_max_size',
      message: `Garment exceeds the maximum size of ${constraints.maxBytes} bytes.`,
      details: { size: garment.size },
    };
  }

  const arrayBuffer = await garment.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const dimensions = imageSize(buffer);

  if (!dimensions.width || !dimensions.height) {
    return {
      ok: false,
      code: 'invalid_dimensions',
      message: 'Unable to determine garment dimensions.',
    };
  }

  if (dimensions.width < constraints.minWidth || dimensions.height < constraints.minHeight) {
    return {
      ok: false,
      code: 'below_min_resolution',
      message: `Garment must be at least ${constraints.minWidth}×${constraints.minHeight} pixels.`,
      details: { width: dimensions.width, height: dimensions.height },
    };
  }

  const checksum = createHash('sha256').update(buffer).digest('hex');

  const metadata: GarmentAssetMetadata = {
    width: dimensions.width,
    height: dimensions.height,
    size: buffer.byteLength,
    contentType: mimeType,
    checksum,
  };

  return {
    ok: true,
    metadata,
  };
}

interface PersistGarmentInput {
  command: GenerationCreateCommand;
  metadata: GarmentAssetMetadata;
  context: GenerationServiceContext;
  generationId: string;
  now: Date;
  logger: Logger;
}

async function persistGarment(input: PersistGarmentInput): Promise<StoredGarmentSnapshot> {
  const { command, metadata, context, generationId, now, logger } = input;
  const sanitizedName = sanitizeFilename(command.garmentFilename);
  const path = `users/${context.userId}/garments/${generationId}/${sanitizedName}`;
  const { error } = await context.supabase.storage
    .from(context.env.garmentBucket)
    .upload(path, command.garment, {
      contentType: metadata.contentType,
      upsert: true,
    });

  if (error) {
    logger.error('Failed to upload garment to storage.', { error: error.message, path });
    throw new GenerationServiceError('Unable to persist garment to storage.', {
      code: 'storage_failure',
      httpStatus: 500,
      cause: error,
      context: { path },
    });
  }

  return {
    path,
    storedAt: now.toISOString(),
    expiresAt: null,
    ...metadata,
  };
}

async function snapshotPersona(
  personaPath: string,
  context: GenerationServiceContext,
  generationId: string,
  logger: Logger,
): Promise<string> {
  const extension = personaPath.split('.').pop() ?? 'png';
  const snapshotPath = `users/${context.userId}/generations/${generationId}/persona.${extension}`;

  const { error } = await context.supabase.storage
    .from(context.env.personaBucket)
    .copy(personaPath, snapshotPath);

  if (error) {
    logger.error('Failed to snapshot persona asset.', {
      personaPath,
      snapshotPath,
      error: error.message,
    });

    throw new GenerationServiceError('Unable to create persona snapshot.', {
      code: 'storage_failure',
      httpStatus: 500,
      cause: error,
    });
  }

  return snapshotPath;
}

interface InsertGenerationInput {
  context: GenerationServiceContext;
  generationId: string;
  personaSnapshotPath: string;
  garmentSnapshotPath: string;
  expiresAt: string;
  now: Date;
  logger: Logger;
}

async function insertGenerationRecord(input: InsertGenerationInput) {
  const { context, generationId, personaSnapshotPath, garmentSnapshotPath, expiresAt, now, logger } = input;

  const { data, error } = await context.supabase
    .from('vton_generations')
    .insert({
      id: generationId,
      user_id: context.userId,
      status: 'queued',
      persona_path_snapshot: personaSnapshotPath,
      cloth_path_snapshot: garmentSnapshotPath,
      expires_at: expiresAt,
      created_at: now.toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    logger.error('Failed to insert generation record.', {
      generationId,
      error: error?.message,
    });

    throw new GenerationServiceError('Unable to queue generation record.', {
      code: 'database_failure',
      httpStatus: 500,
      cause: error,
    });
  }

  return data;
}

async function updateProfileClothCache(
  profile: Database['public']['Tables']['profiles']['Row'],
  snapshot: StoredGarmentSnapshot,
  retainForHours: number,
  context: GenerationServiceContext,
  logger: Logger,
) {
  const expiresAt = new Date(Date.now() + retainForHours * 60 * 60 * 1000).toISOString();

  const { error } = await context.supabase
    .from('profiles')
    .update({
      cloth_path: snapshot.path,
      cloth_expires_at: expiresAt,
      free_generation_used: profile.free_generation_used + 1,
    })
    .eq('user_id', profile.user_id);

  if (error) {
    logger.error('Failed to update profile with new cloth cache.', {
      userId: profile.user_id,
      error: error.message,
    });

    throw new GenerationServiceError('Unable to update profile quota state.', {
      code: 'database_failure',
      httpStatus: 500,
      cause: error,
    });
  }
}

interface EnqueueVertexInput {
  context: GenerationServiceContext;
  generationId: string;
  personaSnapshotPath: string;
  garmentSnapshotPath: string;
  retainForHours: number;
  logger: Logger;
}

async function enqueueVertexJob(input: EnqueueVertexInput) {
  const { context, generationId, personaSnapshotPath, garmentSnapshotPath, retainForHours, logger } = input;

  try {
    return await context.vertexClient.enqueueJob({
      generationId,
      userId: context.userId,
      personaPath: personaSnapshotPath,
      garmentPath: garmentSnapshotPath,
      retainForHours,
    });
  } catch (error) {
    logger.error('Vertex job enqueue failed.', {
      userId: context.userId,
      generationId,
      error,
    });

    throw new GenerationServiceError('Unable to enqueue generation job with Vertex AI.', {
      code: 'vertex_failure',
      httpStatus: 502,
      cause: error,
    });
  }
}

async function setGenerationVertexId(
  context: GenerationServiceContext,
  generationId: string,
  vertexJobId: string,
  logger: Logger,
) {
  const { error } = await context.supabase
    .from('vton_generations')
    .update({ vertex_job_id: vertexJobId })
    .eq('id', generationId);

  if (error) {
    logger.warn('Failed to persist vertex job identifier.', {
      generationId,
      error: error.message,
    });
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]+/g, '_');
}

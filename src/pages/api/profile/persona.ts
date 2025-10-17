import { Buffer } from 'node:buffer';

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { imageSize } from 'image-size';

import type { Database } from '../../../db/database.types.ts';
import type { PersonaAssetWithChecksum, PersonaUploadResponseDto } from '../../../types.ts';
import {
  getProfile,
  ProfileForbiddenError,
  ProfileServiceError,
} from '../../../lib/profile-service.ts';
import {
  parseMultipartRequest,
  type StoredFile,
} from '../../../lib/multipart.ts';
import type { Logger } from '../../../lib/logger.ts';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_KEY;
const PERSONA_BUCKET = import.meta.env.PRIVATE_VTON_PERSONA_BUCKET ?? 'vestilook-personas';
const CACHE_CONTROL_HEADER = 'private, max-age=0, must-revalidate';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 1024;
const MAX_BYTES = 15 * 1024 * 1024;

interface ErrorBody {
  error: string;
  details?: Record<string, unknown>;
}

export const PUT: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);

  if (!PERSONA_BUCKET) {
    logger.error('Persona bucket is not configured.');
    return json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAuthenticatedSupabaseClient(token);
  const userResult = await supabase.auth.getUser(token);
  if (userResult.error || !userResult.data?.user?.id) {
    logger.warn('Failed to resolve user for persona upload.', { error: userResult.error?.message });
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = userResult.data.user.id;

  try {
    const profileResult = await getProfile(supabase, userId, logger);
    if (profileResult.status === 'missing') {
      return json({ error: 'Profile not initialized.' }, { status: 400 });
    }

    if (!profileResult.profile.consent.isCompliant) {
      return json({ error: 'Consent required.' }, { status: 403 });
    }

    const multipart = await parseMultipartRequest(request, {
      limits: { fileSize: MAX_BYTES + 1024 },
      logger,
    });

    const personaFile = multipart.files.find((file) => file.fieldName === 'persona');
    if (!personaFile) {
      await cleanupFiles(multipart.files);
      return json({ error: 'Missing persona file.' }, { status: 400 });
    }

    const validation = await validatePersonaFile(personaFile);
    if (!validation.ok) {
      await cleanupFiles(multipart.files);
      return json(validation.body, { status: validation.status });
    }

    const checksum = firstFieldValue(multipart.fields, 'checksum');
    const widthField = firstFieldValue(multipart.fields, 'width');
    const heightField = firstFieldValue(multipart.fields, 'height');

    const width = Number.parseInt(widthField ?? '', 10) || validation.metadata.width;
    const height = Number.parseInt(heightField ?? '', 10) || validation.metadata.height;

    const uploadPath = buildPersonaStoragePath(userId, personaFile.filename);
    const blob = await personaFile.toBlob();

    const uploadResult = await supabase.storage.from(PERSONA_BUCKET).upload(uploadPath, blob, {
      contentType: personaFile.mimeType,
      upsert: true,
    });

    await cleanupFiles(multipart.files);

    if (uploadResult.error) {
      logger.error('Failed to upload persona to storage.', {
        bucket: PERSONA_BUCKET,
        path: uploadPath,
        message: uploadResult.error.message,
      });
      return json({ error: 'Unable to store persona.' }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        persona_path: uploadPath,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      logger.error('Failed to persist persona metadata.', {
        code: updateError.code,
        message: updateError.message,
      });
      return json({ error: 'Unable to update profile.' }, { status: 500 });
    }

    const personaAsset: PersonaAssetWithChecksum = {
      path: uploadPath,
      updatedAt: new Date().toISOString(),
      width,
      height,
      contentType: personaFile.mimeType,
      checksum: checksum ?? validation.metadata.checksum,
    };

    const responsePayload: PersonaUploadResponseDto = {
      persona: personaAsset,
      consent: {
        requiredVersion: profileResult.profile.consent.currentVersion,
        acceptedVersion: profileResult.profile.consent.acceptedVersion,
        acceptedAt: profileResult.profile.consent.acceptedAt,
      },
    };

    return json(responsePayload, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileForbiddenError) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    if (error instanceof ProfileServiceError) {
      logger.error('Persona upload failed.', { message: error.message, cause: error.options?.cause });
    } else {
      logger.error('Unhandled error during persona upload.', { cause: error });
    }

    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

async function validatePersonaFile(file: StoredFile) {
  if (file.size > MAX_BYTES) {
    return {
      ok: false as const,
      status: 413,
      body: {
        error: 'File too large.',
        details: { maxBytes: MAX_BYTES },
      },
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: 'Unsupported mime type.',
        details: { allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES) },
      },
    };
  }

  const dimensions = await getImageDimensions(file);
  if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: 'Image resolution too small.',
        details: { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT, width: dimensions.width, height: dimensions.height },
      },
    };
  }

  return {
    ok: true as const,
    metadata: {
      width: dimensions.width,
      height: dimensions.height,
      checksum: await computeChecksum(file),
    },
  };
}

async function computeChecksum(file: StoredFile): Promise<string> {
  const blob = await file.toBlob();
  const buffer = Buffer.from(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function getImageDimensions(file: StoredFile): Promise<{ width: number; height: number }> {
  const blob = await file.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const dimensions = imageSize(buffer);
  return {
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
  };
}

async function cleanupFiles(files: StoredFile[]) {
  await Promise.allSettled(files.map((file) => file.cleanup()));
}

function firstFieldValue(fields: Record<string, string[]>, name: string): string | undefined {
  const values = fields[name];
  if (!values || values.length === 0) {
    return undefined;
  }

  return values[0] ?? undefined;
}

function buildPersonaStoragePath(userId: string, filename: string): string {
  const safeFilename = filename.replace(/\s+/g, '-').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '');
  return `personas/${userId}/${timestamp}-${safeFilename}`;
}

function extractBearerToken(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
}

function createAuthenticatedSupabaseClient(accessToken: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function json(body: PersonaUploadResponseDto | ErrorBody, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...cacheHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

function cacheHeaders(): Record<string, string> {
  return { 'Cache-Control': CACHE_CONTROL_HEADER };
}

function createLogger(requestId: string): Logger {
  return {
    error: (message, context) => console.error('[profile/persona]', { requestId, message, ...(context ?? {}) }),
    warn: (message, context) => console.warn('[profile/persona]', { requestId, message, ...(context ?? {}) }),
  };
}

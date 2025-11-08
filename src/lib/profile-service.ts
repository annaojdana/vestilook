import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Tables } from '../db/database.types.ts';
import type {
  ClothCacheDescriptor,
  ConsentStateSnapshot,
  FreeQuotaSnapshot,
  PersonaAssetMetadata,
  ProfileResponseDto,
} from '../types.ts';
import type { Logger } from './logger.ts';

const CONSENT_CURRENT_VERSION = 'v1';
const CONSENT_BOOTSTRAP_VERSION = 'v0';
const DEFAULT_PERSONA_WIDTH = 0;
const DEFAULT_PERSONA_HEIGHT = 0;
const DEFAULT_PERSONA_CONTENT_TYPE = 'image/*';
const DEFAULT_FREE_GENERATION_QUOTA = 3;
const QUOTA_RENEWAL_DAYS = 30;

type ProfileRow = Tables<'profiles'>;

export interface ProfileLookupFound {
  status: 'found';
  profile: ProfileResponseDto;
}

export interface ProfileLookupMissing {
  status: 'missing';
}

export type ProfileLookupResult = ProfileLookupFound | ProfileLookupMissing;

export class ProfileServiceError extends Error {
  constructor(
    message: string,
    public readonly options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'ProfileServiceError';
  }
}

export class ProfileForbiddenError extends ProfileServiceError {
  constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message, options);
    this.name = 'ProfileForbiddenError';
  }
}

type Supabase = SupabaseClient<Database>;

export async function getProfile(
  supabase: Supabase,
  userId: string,
  logger?: Logger,
): Promise<ProfileLookupResult> {
  if (!userId) {
    throw new ProfileServiceError('User identifier is required to fetch profile.');
  }

  const query = supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const { data, error, status } = await query;

  if (error) {
    const context = { userId, status, code: error.code };

    if (status === 403) {
      logger?.warn?.('Access to profile denied by row level security.', context);
      throw new ProfileForbiddenError('Access to profile is forbidden.', { cause: error, context });
    }

    logger?.error('Failed to fetch profile from Supabase.', { ...context, error: error.message });
    throw new ProfileServiceError('Unable to fetch profile data.', { cause: error, context });
  }

  if (!data) {
    return { status: 'missing' };
  }

  const profile = mapProfileRowToDto(data, logger);
  return { status: 'found', profile };
}

export async function ensureProfile(
  supabase: Supabase,
  userId: string,
  logger?: Logger,
): Promise<ProfileResponseDto> {
  const lookup = await getProfile(supabase, userId, logger);
  if (lookup.status === 'found') {
    return lookup.profile;
  }

  await createProfileWithDefaults(supabase, userId, logger);

  const retry = await getProfile(supabase, userId, logger);
  if (retry.status === 'found') {
    return retry.profile;
  }

  throw new ProfileServiceError('Failed to initialize profile record.', {
    context: { userId },
  });
}

function mapProfileRowToDto(row: ProfileRow, logger?: Logger): ProfileResponseDto {
  const persona = mapPersona(row);
  const consent = mapConsent(row);
  const quota = mapQuota(row, logger);
  const clothCache = mapClothCache(row);

  return {
    userId: row.user_id,
    persona,
    consent,
    quota,
    clothCache,
  };
}

async function createProfileWithDefaults(
  supabase: Supabase,
  userId: string,
  logger?: Logger,
): Promise<ProfileResponseDto | null> {
  const quotaRenewalAt = new Date(Date.now() + QUOTA_RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    user_id: userId,
    consent_version: CONSENT_BOOTSTRAP_VERSION,
    consent_accepted_at: new Date().toISOString(),
    free_generation_quota: DEFAULT_FREE_GENERATION_QUOTA,
    free_generation_used: 0,
    quota_renewal_at: quotaRenewalAt,
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      logger?.warn?.('Profile already existed while bootstrapping.', { userId });
      return null;
    }

    logger?.error?.('Unable to bootstrap profile row.', {
      userId,
      code: error.code,
      message: error.message,
    });
    throw new ProfileServiceError('Unable to bootstrap profile data.', { cause: error, context: { userId } });
  }

  if (!data) {
    return null;
  }

  return mapProfileRowToDto(data, logger);
}

function mapPersona(row: ProfileRow): PersonaAssetMetadata | null {
  if (!row.persona_path) {
    return null;
  }

  return {
    path: row.persona_path,
    updatedAt: row.updated_at,
    width: DEFAULT_PERSONA_WIDTH,
    height: DEFAULT_PERSONA_HEIGHT,
    contentType: DEFAULT_PERSONA_CONTENT_TYPE,
  };
}

function mapConsent(row: ProfileRow): ConsentStateSnapshot {
  return {
    currentVersion: CONSENT_CURRENT_VERSION,
    acceptedVersion: row.consent_version,
    acceptedAt: row.consent_accepted_at,
    isCompliant: row.consent_version === CONSENT_CURRENT_VERSION,
  };
}

function mapQuota(row: ProfileRow, logger?: Logger): { free: FreeQuotaSnapshot } {
  const total = safeInteger(row.free_generation_quota);
  const used = safeInteger(row.free_generation_used);
  const remaining = Math.max(total - used, 0);

  if (used > total) {
    logger?.warn?.('Detected quota usage greater than total allocation.', {
      total,
      used,
      userId: row.user_id,
    });
  }

  return {
    free: {
      total,
      used,
      remaining,
      renewsAt: row.quota_renewal_at,
    },
  };
}

function mapClothCache(row: ProfileRow): ClothCacheDescriptor {
  return {
    path: row.cloth_path,
    expiresAt: row.cloth_expires_at,
  };
}

function safeInteger(value: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return Math.floor(value);
}

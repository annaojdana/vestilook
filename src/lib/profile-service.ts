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
const DEFAULT_PERSONA_WIDTH = 0;
const DEFAULT_PERSONA_HEIGHT = 0;
const DEFAULT_PERSONA_CONTENT_TYPE = 'image/*';

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

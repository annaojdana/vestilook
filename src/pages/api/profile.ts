import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../db/database.types.ts';
import type { ProfileResponseDto } from '../../types.ts';
import {
  ensureProfile,
  ProfileForbiddenError,
  ProfileServiceError,
} from '../../lib/profile-service.ts';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_KEY;
const CACHE_CONTROL_HEADER = 'private, max-age=0, must-revalidate';

interface ErrorBody {
  error: string;
}

interface Logger {
  error: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
}

export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': CACHE_CONTROL_HEADER } },
    );
  }

  const supabase = createAuthenticatedSupabaseClient(token);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    logger.warn('Failed to resolve user from access token.', {
      requestId,
      error: userError?.message,
    });
    return json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': CACHE_CONTROL_HEADER } },
    );
  }

  try {
    const profile = await ensureProfile(supabase, userData.user.id, logger);
    const payload = validateProfileResponse(profile);

    return json(payload, {
      status: 200,
      headers: { 'Cache-Control': CACHE_CONTROL_HEADER },
    });
  } catch (error) {
    if (error instanceof ProfileForbiddenError) {
      return json(
        { error: 'Forbidden' },
        { status: 403, headers: { 'Cache-Control': CACHE_CONTROL_HEADER } },
      );
    }

    if (error instanceof ProfileServiceError) {
      logger.error(error.message, {
        requestId,
        cause: error.options?.cause,
        context: error.options?.context,
      });
    } else {
      logger.error('Unhandled error while resolving profile.', {
        requestId,
        cause: error,
      });
    }

    return json(
      { error: 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': CACHE_CONTROL_HEADER } },
    );
  }
};

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

function json<T>(body: T | ErrorBody, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });
}

function validateProfileResponse(payload: ProfileResponseDto): ProfileResponseDto {
  if (!payload || typeof payload !== 'object') {
    throw new ProfileServiceError('Profile payload is invalid.', { context: { payload } });
  }

  if (typeof payload.userId !== 'string' || payload.userId.length === 0) {
    throw new ProfileServiceError('Profile payload missing userId.');
  }

  if (!payload.consent) {
    throw new ProfileServiceError('Profile payload missing consent block.', {
      context: { userId: payload.userId },
    });
  }

  if (typeof payload.consent.currentVersion !== 'string') {
    throw new ProfileServiceError('Profile payload missing consent current version.', {
      context: { userId: payload.userId },
    });
  }

  if (
    !payload.quota ||
    !payload.quota.free ||
    !Number.isFinite(payload.quota.free.total) ||
    !Number.isFinite(payload.quota.free.used) ||
    !Number.isFinite(payload.quota.free.remaining)
  ) {
    throw new ProfileServiceError('Profile payload contains malformed quota snapshot.', {
      context: { userId: payload.userId },
    });
  }

  if (!payload.clothCache) {
    throw new ProfileServiceError('Profile payload missing cloth cache descriptor.', {
      context: { userId: payload.userId },
    });
  }

  return payload;
}

function createLogger(requestId: string): Logger {
  return {
    error: (message, context) =>
      console.error('[profile#get]', { message, requestId, ...(context ?? {}) }),
    warn: (message, context) =>
      console.warn('[profile#get]', { message, requestId, ...(context ?? {}) }),
  };
}

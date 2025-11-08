import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../db/database.types.ts';
import type {
  ConsentReceipt,
  ConsentStateSnapshot,
  ConsentStatusResponseDto,
  ConsentUpsertCommand,
} from '../../../types.ts';
import { ensureProfile, ProfileForbiddenError, ProfileServiceError } from '../../../lib/profile-service.ts';
import type { Logger } from '../../../lib/logger.ts';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_KEY;
const CACHE_CONTROL_HEADER = 'private, max-age=0, must-revalidate';
const DEFAULT_POLICY_URL = import.meta.env.PUBLIC_CONSENT_POLICY_URL ?? '#';
const DEFAULT_POLICY_SOURCE = 'internal';

interface ErrorBody {
  error: string;
  details?: Record<string, unknown>;
}

export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAuthenticatedSupabaseClient(token);
  const userResult = await supabase.auth.getUser(token);
  if (userResult.error || !userResult.data?.user?.id) {
    logger.warn('Failed to resolve user for consent GET.', { error: userResult.error?.message });
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await ensureProfile(supabase, userResult.data.user.id, logger);
    const consent = mapConsentStatus(profile.consent);
    const payload = {
      ...consent,
      policyUrl: DEFAULT_POLICY_URL,
      policyContent: '',
      metadata: {
        source: DEFAULT_POLICY_SOURCE as 'internal' | 'gcp',
        updatedAt: profile.consent.acceptedAt ?? null,
      },
    };

    return json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof ProfileForbiddenError) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    if (error instanceof ProfileServiceError) {
      logger.error('Consent status lookup failed.', { message: error.message, cause: error.options?.cause });
    } else {
      logger.error('Unhandled error while resolving consent status.', { cause: error });
    }

    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let command: ConsentUpsertCommand;
  try {
    command = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!command || typeof command.version !== 'string' || command.version.length === 0 || command.accepted !== true) {
    return json(
      { error: 'Invalid payload.', details: { expected: '{ version: string, accepted: true }' } },
      { status: 400 },
    );
  }

  const supabase = createAuthenticatedSupabaseClient(token);
  const userResult = await supabase.auth.getUser(token);
  if (userResult.error || !userResult.data?.user?.id) {
    logger.warn('Failed to resolve user for consent POST.', { error: userResult.error?.message });
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = userResult.data.user.id;

  try {
    const profile = await ensureProfile(supabase, userId, logger);
    const currentConsent = profile.consent;

    if (currentConsent.acceptedVersion === command.version && currentConsent.isCompliant) {
      return json(
        { error: 'Consent already up to date.' },
        { status: 409 },
      );
    }

    if (currentConsent.currentVersion !== command.version) {
      return json(
        {
          error: 'Consent version mismatch.',
          details: { requiredVersion: currentConsent.currentVersion },
        },
        { status: 409 },
      );
    }

    const acceptedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        consent_version: command.version,
        consent_accepted_at: acceptedAt,
      })
      .eq('user_id', userId);

    if (updateError) {
      logger.error('Failed to update consent version.', {
        code: updateError.code,
        message: updateError.message,
      });
      return json({ error: 'Failed to persist consent.' }, { status: 500 });
    }

    const receipt: ConsentReceipt = {
      acceptedVersion: command.version,
      acceptedAt,
      expiresAt: profile.quota.free.renewsAt ?? null,
    };

    return json(receipt, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileForbiddenError) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    if (error instanceof ProfileServiceError) {
      logger.error('Consent upsert failed.', { message: error.message, cause: error.options?.cause });
    } else {
      logger.error('Unhandled error during consent upsert.', { cause: error });
    }

    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

function mapConsentStatus(consent: ConsentStateSnapshot): ConsentStatusResponseDto {
  return {
    requiredVersion: consent.currentVersion,
    acceptedVersion: consent.acceptedVersion,
    acceptedAt: consent.acceptedAt,
    isCompliant: consent.isCompliant,
  };
}

function cacheHeaders(): Record<string, string> {
  return { 'Cache-Control': CACHE_CONTROL_HEADER };
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

function json(body: unknown, init: ResponseInit): Response {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...cacheHeaders(),
    ...(init.headers ?? {}),
  };

  if (body === null) {
    return new Response(null, { ...init, headers });
  }

  return new Response(JSON.stringify(body), { ...init, headers });
}

function createLogger(requestId: string): Logger {
  return {
    error: (message, context) => console.error('[profile/consent]', { requestId, message, ...(context ?? {}) }),
    warn: (message, context) => console.warn('[profile/consent]', { requestId, message, ...(context ?? {}) }),
  };
}

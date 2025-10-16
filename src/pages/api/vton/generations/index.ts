import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../../db/database.types.ts';
import type { GenerationQueuedResponseDto } from '../../../../types.ts';
import { parseMultipartRequest } from '../../../../lib/multipart.ts';
import { VertexVtonClient } from '../../../../lib/vertex/vton.client.ts';
import { loadVtonEnvironmentConfig } from '../../../../lib/vton/config.ts';
import {
  createGeneration,
  GenerationServiceError,
} from '../../../../lib/vton/generation.service.ts';
import { createLogger } from '../../../../lib/logger.ts';

const CACHE_CONTROL = 'no-store, max-age=0';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

interface SuccessResponseBody extends GenerationQueuedResponseDto {}

export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const logger = createLogger({ name: 'api:vton:generations' }).withRequest(requestId);

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return json(
      {
        error: {
          code: 'unauthorized',
          message: 'Authentication token is required.',
          requestId,
        },
      },
      401,
    );
  }

  const supabase = createAuthenticatedSupabaseClient(token);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    logger.warn('Failed to authenticate user via Supabase.', {
      requestId,
      error: userError?.message,
    });

    return json(
      {
        error: {
          code: 'unauthorized',
          message: 'Unable to resolve authenticated user.',
          requestId,
        },
      },
      401,
    );
  }

  const userId = userData.user.id;

  let fileCleanup: (() => Promise<void>) | undefined;

  try {
    const envConfig = loadVtonEnvironmentConfig();
    const apiKey =
      (typeof import.meta !== 'undefined' &&
        typeof import.meta.env !== 'undefined' &&
        import.meta.env.GOOGLE_VERTEX_API_KEY) ??
      process.env.GOOGLE_VERTEX_API_KEY;

    if (!apiKey) {
      logger.error('Missing Google Vertex API key.');
      return json(
        {
          error: {
            code: 'server_misconfigured',
            message: 'Vertex integration is misconfigured.',
            requestId,
          },
        },
        500,
      );
    }

    const vertexClient = new VertexVtonClient({
      apiKey,
      env: envConfig,
      logger,
    });

    let multipart;
    try {
      multipart = await parseMultipartRequest(request, {
        limits: {
          fileSize: envConfig.maxGarmentBytes,
          files: 1,
        },
        logger,
      });
    } catch (parseError) {
      logger.warn('Failed to parse multipart form data.', {
        requestId,
        error: parseError,
      });

      return json(
        {
          error: {
            code: 'invalid_request',
            message: 'Unable to parse multipart form data.',
            requestId,
          },
        },
        400,
      );
    }

    const consentVersion = firstFieldValue(multipart.fields, 'consentVersion');
    if (!consentVersion) {
      return json(
        {
          error: {
            code: 'invalid_request',
            message: 'consentVersion field is required.',
            requestId,
          },
        },
        400,
      );
    }

    const retainForHours = parseOptionalInteger(firstFieldValue(multipart.fields, 'retainForHours'));

    const garmentFile = multipart.files.find((file) => file.fieldName === 'garment');
    if (!garmentFile) {
      return json(
        {
          error: {
            code: 'invalid_request',
            message: 'Garment file is required.',
            requestId,
          },
        },
        400,
      );
    }

    fileCleanup = garmentFile.cleanup;

    const garmentBlob = await garmentFile.toBlob();

    const result = await createGeneration(
      {
        garment: garmentBlob,
        garmentFilename: garmentFile.filename,
        consentVersion,
        retainForHours,
      },
      {
        userId,
        supabase,
        env: envConfig,
        vertexClient,
        logger,
      },
    );

    const response = json(result, 202);
    response.headers.set('Location', `/api/vton/generations/${result.id}`);
    return response;
  } catch (error) {
    if (error instanceof GenerationServiceError) {
      logger.warn('Generation request failed due to handled error.', {
        requestId,
        code: error.options.code,
        context: error.options.context,
      });

      return json(
        {
          error: {
            code: error.options.code,
            message: error.message,
            requestId,
          },
        },
        error.options.httpStatus,
      );
    }

    logger.error('Unhandled error while queuing VTON generation.', {
      requestId,
      error,
    });

    return json(
      {
        error: {
          code: 'internal_error',
          message: 'Unexpected error while processing request.',
          requestId,
        },
      },
      500,
    );
  } finally {
    await fileCleanup?.();
  }
};

function createAuthenticatedSupabaseClient(accessToken: string) {
  const url =
    (typeof import.meta !== 'undefined' &&
      typeof import.meta.env !== 'undefined' &&
      import.meta.env.SUPABASE_URL) ??
    process.env.SUPABASE_URL;
  const anonKey =
    (typeof import.meta !== 'undefined' &&
      typeof import.meta.env !== 'undefined' &&
      import.meta.env.SUPABASE_KEY) ??
    process.env.SUPABASE_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is missing.');
  }

  return createClient<Database>(url, anonKey, {
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

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
}

function firstFieldValue(
  fields: Record<string, string[]>,
  name: string,
): string | null {
  const values = fields[name];
  if (!values || values.length === 0) {
    return null;
  }

  return values[0];
}

function parseOptionalInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new GenerationServiceError('retainForHours must be an integer.', {
      code: 'invalid_request',
      httpStatus: 400,
      context: { value },
    });
  }

  return parsed;
}

function json(
  body: SuccessResponseBody | ErrorResponseBody,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
    },
  });
}

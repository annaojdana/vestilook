import type { APIRoute } from 'astro';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database, Tables } from '../../../../db/database.types.ts';
import type {
  GenerationListResponseDto,
  GenerationQueuedResponseDto,
  GenerationStatus,
  GenerationSummaryDto,
} from '../../../../types.ts';
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

type SuccessResponseBody = GenerationQueuedResponseDto | GenerationListResponseDto;

export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const logger = createLogger({ name: 'api:vton:generations:get' }).withRequest(requestId);

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

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  let limit: number;
  let statuses: GenerationStatus[];
  let createdFrom: string | undefined;
  let createdTo: string | undefined;
  let cursor: string | undefined;

  try {
    limit = parseLimit(searchParams.get('limit'));
    statuses = parseStatusParam(searchParams.get('status'));
    createdFrom = parseIsoParam(searchParams.get('from'), 'from');
    createdTo = parseIsoParam(searchParams.get('to'), 'to');
    cursor = parseIsoParam(searchParams.get('cursor'), 'cursor');
  } catch (parseError) {
    return json(
      {
        error: {
          code: 'invalid_request',
          message: (parseError as Error).message,
          requestId,
        },
      },
      400,
    );
  }

  try {
    const supabase = createAuthenticatedSupabaseClient(token);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      logger.warn('Failed to authenticate user for generations history.', {
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

    const envConfig = loadVtonEnvironmentConfig();

    let query = supabase
      .from('vton_generations')
      .select('id,status,created_at,completed_at,error_reason,expires_at,result_path,user_rating')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }
    if (createdFrom) {
      query = query.gte('created_at', createdFrom);
    }
    if (createdTo) {
      query = query.lte('created_at', createdTo);
    }
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch generations history.', {
        requestId,
        error: error.message,
      });
      return json(
        {
          error: {
            code: 'internal_error',
            message: 'Unable to fetch generation history.',
            requestId,
          },
        },
        500,
      );
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const trimmedRows = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? rows[rows.length - 1].created_at : null;

    const summaries = await Promise.all(
      trimmedRows.map(async (row) => {
        const thumbnailUrl = await createSignedResultUrl(
          supabase,
          envConfig.generationBucket,
          row.result_path,
        );
        return mapRowToSummary(row, thumbnailUrl);
      }),
    );

    return json(
      {
        items: summaries,
        nextCursor,
      },
      200,
    );
  } catch (error) {
    logger.error('Unhandled error while fetching generations history.', {
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
  }
};

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

function parseLimit(raw: string | null): number {
  if (!raw) {
    return 20;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('limit must be a positive integer.');
  }

  return Math.min(parsed, 50);
}

const VALID_STATUSES: GenerationStatus[] = ['queued', 'processing', 'succeeded', 'failed', 'expired'];

function parseStatusParam(value: string | null): GenerationStatus[] {
  if (!value) {
    return [];
  }

  const statuses = value
    .split(',')
    .map((status) => status.trim())
    .filter(Boolean) as GenerationStatus[];

  for (const status of statuses) {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Unsupported status filter value: ${status}`);
    }
  }

  return statuses;
}

function parseIsoParam(value: string | null, field: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field} must be a valid ISO-8601 timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

async function createSignedResultUrl(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string | null,
): Promise<string | null> {
  if (!bucket || !path) {
    return null;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

function mapRowToSummary(
  row: Tables<'vton_generations'>,
  thumbnailUrl: string | null,
): GenerationSummaryDto {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    thumbnailUrl: thumbnailUrl ?? '',
    rating: row.user_rating,
    errorReason: row.error_reason,
    expiresAt: row.expires_at,
  };
}

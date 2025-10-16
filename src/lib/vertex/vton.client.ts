import type { Logger } from '../logger.ts';
import { createLogger } from '../logger.ts';
import type { VtonEnvironmentConfig } from '../../types.ts';
import type { VertexClient, VertexEnqueueInput, VertexEnqueueResult } from '../vton/generation.service.ts';

export interface VertexVtonClientOptions {
  apiKey: string;
  env: VtonEnvironmentConfig;
  logger?: Logger;
  fetcher?: typeof fetch;
}

interface VertexResponse {
  name?: string;
  jobId?: string;
  etaSeconds?: number;
}

export class VertexVtonClient implements VertexClient {
  private readonly apiKey: string;
  private readonly env: VtonEnvironmentConfig;
  private readonly logger: Logger;
  private readonly fetcher: typeof fetch;

  constructor(options: VertexVtonClientOptions) {
    if (!options?.apiKey) {
      throw new Error('Vertex API key is required.');
    }

    this.apiKey = options.apiKey;
    this.env = options.env;
    this.logger = options.logger ?? createLogger({ name: 'vertex-vton-client' });
    this.fetcher = options.fetcher ?? fetch;
  }

  async enqueueJob(input: VertexEnqueueInput): Promise<VertexEnqueueResult> {
    const url = this.buildUrl();
    const payload = {
      model: this.env.vertexModel,
      input: {
        personaUri: this.buildGcsUri(this.env.personaBucket, input.personaPath),
        garmentUri: this.buildGcsUri(this.env.garmentBucket, input.garmentPath),
        retainForHours: input.retainForHours,
      },
      metadata: {
        generationId: input.generationId,
        userId: input.userId,
      },
    };

    const response = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await safeJson(response);
      this.logger.error('Vertex API returned non-success status.', {
        status: response.status,
        body: errorBody,
      });

      throw new Error(
        `Vertex API request failed with status ${response.status}.`,
      );
    }

    const body = (await safeJson(response)) as VertexResponse;
    const jobId = body?.jobId ?? body?.name;

    if (!jobId) {
      this.logger.warn('Vertex API response missing job identifier.', { body });
      throw new Error('Vertex API response missing job identifier.');
    }

    return {
      jobId,
      etaSeconds: typeof body?.etaSeconds === 'number' ? body.etaSeconds : undefined,
    };
  }

  private buildUrl(): string {
    const base = `https://${this.env.vertexLocation}-aiplatform.googleapis.com/v1`;
    const path = `/projects/${this.env.vertexProjectId}/locations/${this.env.vertexLocation}/virtualTryOn:enqueue`;
    return `${base}${path}`;
  }

  private buildGcsUri(bucket: string, path: string): string {
    const normalized = path.startsWith('gs://') ? path : `gs://${bucket}/${path.replace(/^\/+/, '')}`;
    return normalized;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

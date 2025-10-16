import { describe, expect, it, vi } from 'vitest';

import type { VtonEnvironmentConfig } from '../../types.ts';
import { VertexVtonClient } from './vton.client.ts';

const env: VtonEnvironmentConfig = {
  vertexProjectId: 'project-1',
  vertexLocation: 'us-central1',
  vertexModel: 'virtualTryOnModels/default',
  garmentBucket: 'garment-bucket',
  personaBucket: 'persona-bucket',
  generationBucket: 'generation-bucket',
  defaultEtaSeconds: 180,
  maxGarmentBytes: 7340032,
  minGarmentWidth: 1024,
  minGarmentHeight: 1024,
  allowedGarmentMimeTypes: ['image/png'],
};

describe('VertexVtonClient', () => {
  it('sends request and returns job id', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ jobId: 'operations/123', etaSeconds: 210 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new VertexVtonClient({
      apiKey: 'api-key',
      env,
      fetcher,
    });

    const result = await client.enqueueJob({
      generationId: 'gen-1',
      userId: 'user-1',
      personaPath: 'persona.png',
      garmentPath: 'garment.png',
      retainForHours: 48,
    });

    expect(result.jobId).toBe('operations/123');
    expect(result.etaSeconds).toBe(210);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('virtualTryOn:enqueue'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': 'api-key',
        }),
      }),
    );
  });

  it('throws when response lacks job id', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new VertexVtonClient({
      apiKey: 'key',
      env,
      fetcher,
    });

    await expect(
      client.enqueueJob({
        generationId: 'gen-1',
        userId: 'user-1',
        personaPath: 'persona.png',
        garmentPath: 'garment.png',
        retainForHours: 48,
      }),
    ).rejects.toThrow(/job identifier/i);
  });
});

import { Buffer } from 'node:buffer';

import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../db/database.types.ts';
import type { VtonEnvironmentConfig } from '../../types.ts';
import {
  createGeneration,
  ensureQuota,
  validateGarment,
  GenerationServiceError,
} from './generation.service.ts';

function createPngBlob(): Blob {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  return new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' });
}

const defaultEnv: VtonEnvironmentConfig = {
  vertexProjectId: 'project',
  vertexLocation: 'us-central1',
  vertexModel: 'virtualTryOnModels/default',
  garmentBucket: 'garments',
  personaBucket: 'personas',
  generationBucket: 'generations',
  defaultEtaSeconds: 180,
  maxGarmentBytes: 1024 * 1024,
  minGarmentWidth: 1,
  minGarmentHeight: 1,
  allowedGarmentMimeTypes: ['image/png'],
};

type SupabaseMock = Parameters<typeof createGeneration>[1]['supabase'];

function buildSupabaseWithProfile(profileRow: Database['public']['Tables']['profiles']['Row']) {
  const garmentUpload = vi.fn(async () => ({ data: null, error: null }));
  const personaCopy = vi.fn(async () => ({ data: null, error: null }));
  const profileUpdateCalls: unknown[] = [];
  const generationInsertPayloads: unknown[] = [];
  const generationUpdateCalls: unknown[] = [];

  const supabase = {
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket === defaultEnv.garmentBucket) {
          return { upload: garmentUpload };
        }

        if (bucket === defaultEnv.personaBucket) {
          return { copy: personaCopy };
        }

        throw new Error(`Unexpected bucket ${bucket}`);
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: profileRow,
                error: null,
                status: 200,
              }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: () => {
              profileUpdateCalls.push(payload);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }

      if (table === 'vton_generations') {
        return {
          insert: (payload: unknown) => {
            generationInsertPayloads.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'gen-999',
                    user_id: profileRow.user_id,
                    status: 'queued' as const,
                    vertex_job_id: null,
                    persona_path_snapshot: 'users/user-1/generations/gen-999/persona.png',
                    cloth_path_snapshot: 'users/user-1/garments/gen-999/Garment_File.png',
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
                    completed_at: null,
                    error_reason: null,
                    rated_at: null,
                    result_path: null,
                    started_at: null,
                    user_rating: null,
                  },
                  error: null,
                }),
              }),
            };
          },
          update: (changes: unknown) => ({
            eq: () => {
              generationUpdateCalls.push(changes);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as SupabaseMock;

  return {
    supabase,
    garmentUpload,
    personaCopy,
    profileUpdateCalls,
    generationInsertPayloads,
    generationUpdateCalls,
  };
}

describe('validateGarment', () => {
  it('rejects unsupported mime types', async () => {
    const garment = new Blob([new Uint8Array([0, 1, 2])], { type: 'image/gif' });
    const result = await validateGarment(garment, {
      allowedMimeTypes: ['image/png'],
      maxBytes: 1024,
      minWidth: 1,
      minHeight: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unsupported_mime');
    }
  });
});

describe('ensureQuota', () => {
  it('throws when quota exhausted', () => {
    const profile: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'personas/user-1.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 3,
      free_generation_used: 3,
      quota_renewal_at: null,
    };

    expect(() => ensureQuota(profile)).toThrowError(/quota exhausted/i);
  });
});

describe('createGeneration', () => {
  it('queues generation and returns queued response', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 2,
      quota_renewal_at: null,
    };

    const insertedGeneration = {
      id: 'gen-123',
      user_id: profileRow.user_id,
      status: 'queued' as const,
      vertex_job_id: null,
      persona_path_snapshot: 'users/user-1/generations/gen-123/persona.png',
      cloth_path_snapshot: 'users/user-1/garments/gen-123/Garment_File.png',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      completed_at: null,
      error_reason: null,
      rated_at: null,
      result_path: null,
      started_at: null,
      user_rating: null,
    };

    const garmentUpload = vi.fn(async () => ({ data: null, error: null }));
    const personaCopy = vi.fn(async () => ({ data: null, error: null }));

    const profileUpdateCalls: unknown[] = [];
    const generationInsertPayloads: unknown[] = [];
    const generationUpdateCalls: unknown[] = [];

    const supabase = {
      storage: {
        from: vi.fn((bucket: string) => {
          if (bucket === defaultEnv.garmentBucket) {
            return { upload: garmentUpload };
          }

          if (bucket === defaultEnv.personaBucket) {
            return { copy: personaCopy };
          }

          throw new Error(`Unexpected bucket ${bucket}`);
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: profileRow,
                  error: null,
                  status: 200,
                }),
              }),
            }),
            update: (payload: unknown) => ({
              eq: () => {
                profileUpdateCalls.push(payload);
                return Promise.resolve({ data: null, error: null });
              },
            }),
          };
        }

        if (table === 'vton_generations') {
          return {
            insert: (payload: unknown) => {
              generationInsertPayloads.push(payload);
              return {
                select: () => ({
                  single: async () => ({
                    data: insertedGeneration,
                    error: null,
                  }),
                }),
              };
            },
            update: (changes: unknown) => ({
              eq: () => {
                generationUpdateCalls.push(changes);
                return Promise.resolve({ data: null, error: null });
              },
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as Parameters<typeof createGeneration>[1]['supabase'];

    const vertexClient = {
      enqueueJob: vi.fn(async () => ({ jobId: 'vertex-job-1', etaSeconds: 210 })),
    };

    const now = new Date('2024-05-01T12:00:00.000Z');

    const response = await createGeneration(
      {
        garment: createPngBlob(),
        garmentFilename: 'Garment File.png',
        consentVersion: 'v1',
        retainForHours: 48,
      },
      {
        userId: profileRow.user_id,
        supabase,
        env: defaultEnv,
        vertexClient,
        now: () => now,
        idFactory: () => insertedGeneration.id,
      },
    );

    expect(response.id).toBe(insertedGeneration.id);
    expect(response.status).toBe('queued');
    expect(response.vertexJobId).toBe('vertex-job-1');
    expect(response.clothSnapshotPath).toContain('Garment_File.png');
    expect(response.etaSeconds).toBe(210);
    expect(response.quota.remainingFree).toBe(2);
    expect(response.expiresAt).toBe(insertedGeneration.expires_at);
    expect(vertexClient.enqueueJob).toHaveBeenCalledWith({
      generationId: insertedGeneration.id,
      userId: profileRow.user_id,
      personaPath: 'users/user-1/generations/gen-123/persona.png',
      garmentPath: 'users/user-1/garments/gen-123/Garment_File.png',
      retainForHours: 48,
    });

    expect(garmentUpload).toHaveBeenCalledWith(
      'users/user-1/garments/gen-123/Garment_File.png',
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/png', upsert: true }),
    );

    expect(personaCopy).toHaveBeenCalledWith(
      profileRow.persona_path,
      'users/user-1/generations/gen-123/persona.png',
    );

    expect(profileUpdateCalls).toHaveLength(1);
    expect(profileUpdateCalls[0]).toMatchObject({
      cloth_path: 'users/user-1/garments/gen-123/Garment_File.png',
      free_generation_used: profileRow.free_generation_used + 1,
    });

    expect(generationInsertPayloads).toHaveLength(1);
    expect(generationUpdateCalls).toHaveLength(1);
  });

  it('throws when consent version mismatches profile state', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v2',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await createGeneration(
      {
        garment: createPngBlob(),
        garmentFilename: 'garment.png',
        consentVersion: 'v1',
        retainForHours: 48,
      },
      {
        userId: profileRow.user_id,
        supabase,
        env: defaultEnv,
        vertexClient,
      },
    ).then(
      () => {
        throw new Error('Expected consent mismatch to reject.');
      },
      (error) => {
        expect(error).toBeInstanceOf(GenerationServiceError);
        expect(error).toMatchObject({
          options: { code: 'consent_mismatch', httpStatus: 403 },
        });
      },
    );

    expect(vertexClient.enqueueJob).not.toHaveBeenCalled();
  });

  it('throws when persona asset missing on profile', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: null,
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await expect(
      createGeneration(
        {
          garment: createPngBlob(),
          garmentFilename: 'garment.png',
          consentVersion: 'v1',
          retainForHours: 48,
        },
        {
          userId: profileRow.user_id,
          supabase,
          env: defaultEnv,
          vertexClient,
        },
      ),
    ).rejects.toMatchObject({
      options: { code: 'persona_missing', httpStatus: 403 },
    });

    expect(vertexClient.enqueueJob).not.toHaveBeenCalled();
  });

  it('defaults retainForHours to 48 when not provided', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn(async () => ({ jobId: 'vertex-job', etaSeconds: 180 })) };

    await createGeneration(
      {
        garment: createPngBlob(),
        garmentFilename: 'garment.png',
        consentVersion: 'v1',
      },
      {
        userId: profileRow.user_id,
        supabase,
        env: defaultEnv,
        vertexClient,
        idFactory: () => 'gen-default-retention',
      },
    );

    expect(vertexClient.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        retainForHours: 48,
      }),
    );
  });

  it('rejects non-integer retention values', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await expect(
      createGeneration(
        {
          garment: createPngBlob(),
          garmentFilename: 'garment.png',
          consentVersion: 'v1',
          retainForHours: 36.5,
        },
        {
          userId: profileRow.user_id,
          supabase,
          env: defaultEnv,
          vertexClient,
        },
      ),
    ).rejects.toMatchObject({
      options: { code: 'invalid_request', httpStatus: 400 },
    });
  });

  it('rejects retention shorter than 24 hours', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await expect(
      createGeneration(
        {
          garment: createPngBlob(),
          garmentFilename: 'garment.png',
          consentVersion: 'v1',
          retainForHours: 12,
        },
        {
          userId: profileRow.user_id,
          supabase,
          env: defaultEnv,
          vertexClient,
        },
      ),
    ).rejects.toMatchObject({
      options: { code: 'invalid_request', httpStatus: 400 },
    });
  });

  it('rejects retention longer than 72 hours', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await expect(
      createGeneration(
        {
          garment: createPngBlob(),
          garmentFilename: 'garment.png',
          consentVersion: 'v1',
          retainForHours: 96,
        },
        {
          userId: profileRow.user_id,
          supabase,
          env: defaultEnv,
          vertexClient,
        },
      ),
    ).rejects.toMatchObject({
      options: { code: 'invalid_request', httpStatus: 400 },
    });
  });

  it('throws when garment blob missing', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await expect(
      createGeneration(
        {
          garment: undefined as unknown as Blob,
          garmentFilename: 'garment.png',
          consentVersion: 'v1',
          retainForHours: 48,
        },
        {
          userId: profileRow.user_id,
          supabase,
          env: defaultEnv,
          vertexClient,
        },
      ),
    ).rejects.toMatchObject({
      options: { code: 'invalid_request', httpStatus: 400 },
    });
  });

  it('throws when garment filename missing', async () => {
    const profileRow: Database['public']['Tables']['profiles']['Row'] = {
      user_id: 'user-1',
      consent_version: 'v1',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: 'users/user-1/persona.png',
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    const { supabase } = buildSupabaseWithProfile(profileRow);
    const vertexClient = { enqueueJob: vi.fn() };

    await expect(
      createGeneration(
        {
          garment: createPngBlob(),
          garmentFilename: '',
          consentVersion: 'v1',
          retainForHours: 48,
        },
        {
          userId: profileRow.user_id,
          supabase,
          env: defaultEnv,
          vertexClient,
        },
      ),
    ).rejects.toMatchObject({
      options: { code: 'invalid_request', httpStatus: 400 },
    });
  });
});

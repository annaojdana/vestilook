// @vitest-environment node

import { Buffer } from "node:buffer";

import { http, HttpResponse } from "msw";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import type { Database } from "@/db/database.types.ts";
import { server } from "../setup.ts";
import { createTestPngBlob, setTestEnvironment } from "../support/env.ts";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface SupabaseMockState {
  uploads: Array<{ bucket: string; path: string; options: unknown }>;
  copies: Array<{ bucket: string; from: string; to: string }>;
  profileUpdates: Array<Record<string, unknown>>;
  generationInserts: Array<Record<string, unknown>>;
  generationUpdates: Array<{ id: string; changes: Record<string, unknown> }>;
  authTokens: string[];
}

interface SupabaseMockContext {
  supabase: {
    auth: {
      getUser: (token: string) => Promise<{
        data: { user: { id: string } };
        error: null;
      }>;
    };
    storage: {
      from: (bucket: string) => {
        upload?: (path: string, data: Blob, options?: unknown) => Promise<{ data: null; error: null }>;
        copy?: (from: string, to: string) => Promise<{ data: null; error: null }>;
      };
    };
    from: (
      table: string,
    ) => {
      select?: () => {
        eq: (field: string, value: string) => {
          maybeSingle: () => Promise<{ data: ProfileRow | null; error: null; status: number }>;
        };
      };
      update?: (payload: Record<string, unknown>) => {
        eq: (field: string, value: string) => Promise<{ data: null; error: null }>;
      };
      insert?: (payload: Record<string, unknown>) => {
        select: () => {
          single: () => Promise<{ data: Record<string, unknown>; error: null }>;
        };
      };
    };
  };
  state: SupabaseMockState;
}

let supabaseContext: SupabaseMockContext | null = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => {
    if (!supabaseContext) {
      throw new Error("Supabase mock was not initialised before createClient call.");
    }

    return supabaseContext.supabase;
  }),
}));

const vertexRequests: Array<unknown> = [];

const { POST } = await import("@/pages/api/vton/generations/index.ts");

function buildSupabaseWithProfile(profile: ProfileRow): SupabaseMockContext {
  const garmentBucket = process.env.PRIVATE_VTON_GARMENT_BUCKET!;
  const personaBucket = process.env.PRIVATE_VTON_PERSONA_BUCKET!;

  const state: SupabaseMockState = {
    uploads: [],
    copies: [],
    profileUpdates: [],
    generationInserts: [],
    generationUpdates: [],
    authTokens: [],
  };

  const generationRows = new Map<string, Record<string, unknown>>();

  return {
    supabase: {
      auth: {
        getUser: async (token: string) => {
          state.authTokens.push(token);
          return {
            data: { user: { id: profile.user_id } },
            error: null,
          };
        },
      },
      storage: {
        from: (bucket: string) => {
          if (bucket === garmentBucket) {
            return {
              upload: async (path: string, data: Blob, options?: unknown) => {
                state.uploads.push({ bucket, path, options });
                // force read to ensure blob accessible
                await data.arrayBuffer();
                return { data: null, error: null };
              },
            };
          }

          if (bucket === personaBucket) {
            return {
              copy: async (from: string, to: string) => {
                state.copies.push({ bucket, from, to });
                return { data: null, error: null };
              },
            };
          }

          throw new Error(`Unexpected bucket access: ${bucket}`);
        },
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: (field: string, value: string) => ({
                maybeSingle: async () => ({
                  data: field === "user_id" && value === profile.user_id ? { ...profile } : null,
                  error: null,
                  status: 200,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => ({
              eq: async (field: string, value: string) => {
                if (field !== "user_id" || value !== profile.user_id) {
                  throw new Error("Unexpected profiles.update filter");
                }

                state.profileUpdates.push(payload);
                Object.assign(profile, payload);
                return { data: null, error: null };
              },
            }),
          };
        }

        if (table === "vton_generations") {
          return {
            insert: (payload: Record<string, unknown>) => {
              const record = {
                vertex_job_id: null,
                created_at: new Date().toISOString(),
                ...payload,
              };
              state.generationInserts.push(record);
              generationRows.set(String(payload.id), record);

              return {
                select: () => ({
                  single: async () => ({
                    data: { ...record },
                    error: null,
                  }),
                }),
              };
            },
            update: (changes: Record<string, unknown>) => ({
              eq: async (field: string, value: string) => {
                if (field !== "id") {
                  throw new Error("Unexpected generations.update filter");
                }

                const row = generationRows.get(value);
                if (!row) {
                  throw new Error("Generation row not found for update");
                }

                Object.assign(row, changes);
                state.generationUpdates.push({ id: value, changes });
                return { data: { ...row }, error: null };
              },
            }),
          };
        }

        throw new Error(`Unexpected table access: ${table}`);
      },
    },
    state,
  };
}

beforeEach(() => {
  setTestEnvironment();
  vertexRequests.length = 0;

  server?.use(
    http.post(
      "https://europe-west1-aiplatform.googleapis.com/v1/projects/test-project/locations/europe-west1/virtualTryOn:enqueue",
      async ({ request }) => {
        const body = await request.json();
        vertexRequests.push(body);
        return HttpResponse.json(
          {
            jobId: "vertex-job-123",
            etaSeconds: 186,
          },
          { status: 200 },
        );
      },
    ),
  );
});

afterEach(() => {
  supabaseContext = null;
  server?.resetHandlers();
});

describe("VTON generation API integration", () => {
  it("queues generation and persists state across Supabase and Vertex integrations", async () => {
    const profile: ProfileRow = {
      user_id: "user-123",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-123/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "48");
    formData.set("garment", createTestPngBlob(), "coat.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
      },
      body: formData,
      redirect: "manual",
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(202);
    expect(response.headers.get("Location")).toMatch(/^\/api\/vton\/generations\//);

    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: "queued",
      vertexJobId: "vertex-job-123",
      quota: { remainingFree: 3 },
      etaSeconds: 186,
    });

    expect(vertexRequests).toHaveLength(1);
    expect(vertexRequests[0]).toMatchObject({
      model: "virtualTryOnModels/test",
      input: {
        retainForHours: 48,
      },
      metadata: {
        userId: "user-123",
      },
    });

    const state = supabaseContext?.state;
    expect(state?.authTokens).toEqual(["access-token"]);
    expect(state?.uploads).toHaveLength(1);
    expect(state?.uploads[0]).toMatchObject({
      bucket: "garments-bucket",
    });
    expect(state?.copies).toEqual([
      {
        bucket: "persona-bucket",
        from: "users/user-123/persona.png",
        to: expect.stringContaining("/persona."),
      },
    ]);
    expect(state?.profileUpdates).toHaveLength(1);
    expect(state?.profileUpdates[0]).toMatchObject({
      cloth_path: expect.stringContaining("/coat.png"),
      free_generation_used: 2,
    });
    expect(state?.generationInserts).toHaveLength(1);
    expect(state?.generationUpdates).toHaveLength(1);
  });

  it("returns quota error without invoking Vertex when free quota exhausted", async () => {
    const profile: ProfileRow = {
      user_id: "user-999",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-999/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 2,
      free_generation_used: 2,
      quota_renewal_at: new Date().toISOString(),
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "24");
    formData.set("garment", createTestPngBlob(), "dress.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer other-token",
      },
      body: formData,
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(429);

    const errorPayload = (await response.json()) as { error: { code: string } };
    expect(errorPayload.error.code).toBe("quota_exhausted");

    expect(vertexRequests).toHaveLength(0);
    const state = supabaseContext?.state;
    expect(state?.authTokens).toEqual(["other-token"]);
    expect(state?.uploads).toHaveLength(0);
    expect(state?.profileUpdates).toHaveLength(0);
  });

  it("returns error when Vertex API fails and ensures temporary files are cleaned up", async () => {
    const profile: ProfileRow = {
      user_id: "user-vertex-fail",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-vertex-fail/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    server?.use(
      http.post(
        "https://europe-west1-aiplatform.googleapis.com/v1/projects/test-project/locations/europe-west1/virtualTryOn:enqueue",
        async ({ request }) => {
          const body = await request.json();
          vertexRequests.push(body);
          return HttpResponse.json(
            {
              error: { message: "Vertex outage" },
            },
            { status: 503 },
          );
        },
      ),
    );

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "48");
    formData.set("garment", createTestPngBlob(), "fail.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer vertex-fail-token",
      },
      body: formData,
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(502);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("vertex_failure");

    const state = supabaseContext?.state;
    expect(state?.authTokens).toEqual(["vertex-fail-token"]);
    expect(state?.uploads).toHaveLength(1); // Attempted upload before failure
    expect(state?.generationInserts).toHaveLength(1);
    expect(state?.generationUpdates).toHaveLength(0); // No update to queued record
    expect(vertexRequests).toHaveLength(1);
  });

  it("returns misconfiguration error when Vertex API key missing", async () => {
    const originalApiKey = process.env.GOOGLE_VERTEX_API_KEY;
    delete process.env.GOOGLE_VERTEX_API_KEY;

    const profile: ProfileRow = {
      user_id: "user-misconfig",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-misconfig/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 3,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "48");
    formData.set("garment", createTestPngBlob(), "missing-key.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer misconfig-token",
      },
      body: formData,
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(500);

    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("server_misconfigured");
    expect(vertexRequests).toHaveLength(0);

    process.env.GOOGLE_VERTEX_API_KEY = originalApiKey;
  });

  it("rejects retainForHours greater than 72", async () => {
    const profile: ProfileRow = {
      user_id: "user-retention-high",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-retention-high/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "96");
    formData.set("garment", createTestPngBlob(), "retain-high.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: { Authorization: "Bearer retention-high" },
      body: formData,
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("invalid_request");
  });

  it("rejects retainForHours lower than 24", async () => {
    const profile: ProfileRow = {
      user_id: "user-retention-low",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-retention-low/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "12");
    formData.set("garment", createTestPngBlob(), "retain-low.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: { Authorization: "Bearer retention-low" },
      body: formData,
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("invalid_request");
  });

  it("returns parsing error when multipart request invalid and ensures cleanup", async () => {
    const profile: ProfileRow = {
      user_id: "user-multipart-fail",
      consent_version: "v1",
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persona_path: "users/user-multipart-fail/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseWithProfile(profile);

    const largeBlob = new Blob([Buffer.alloc(20 * 1024 * 1024)], { type: "image/png" });

    const formData = new FormData();
    formData.set("consentVersion", "v1");
    formData.set("retainForHours", "48");
    formData.set("garment", largeBlob, "huge.png");

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: { Authorization: "Bearer multipart-fail" },
      body: formData,
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("invalid_request");

    const state = supabaseContext?.state;
    expect(state?.uploads).toHaveLength(0);
    expect(vertexRequests).toHaveLength(0);
  });
});

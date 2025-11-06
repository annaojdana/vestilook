// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/database.types.ts";
import type { Tables } from "@/db/database.types.ts";
import { server } from "../setup.ts";
import { setTestEnvironment } from "../support/env.ts";

vi.mock("image-size", () => {
  const imageSize = vi.fn(() => ({ width: 2048, height: 2048 }));
  return { imageSize };
});

const { imageSize } = await import("image-size");

type ProfileRow = Tables<"profiles">;

interface SupabaseMockState {
  maybeSingleResult: {
    data: ProfileRow | null;
    error: { message: string; code: string } | null;
    status: number;
  };
  profileUpdates: Array<{ payload: Record<string, unknown>; filter: { field: string; value: string } }>;
  uploads: Array<{ bucket: string; path: string; options?: unknown; data: Blob }>;
  authTokens: string[];
}

interface SupabaseMockContext {
  supabase: DatabaseClientMock;
  state: SupabaseMockState;
}

type DatabaseClientMock = {
  auth: {
    getUser: (token: string) => Promise<{ data: { user: { id: string } } | null; error: { message: string } | null }>;
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, data: Blob, options?: unknown) => Promise<{ data: null; error: null | { message: string } }>;
    };
  };
  from: (table: string) => {
    select: () => {
      eq: (field: string, value: string) => {
        maybeSingle: () => Promise<SupabaseMockState["maybeSingleResult"]>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (field: string, value: string) => Promise<{ data: null; error: null | { code: string; message: string } }>;
    };
  };
};

let supabaseContext: SupabaseMockContext | null = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => {
    if (!supabaseContext) {
      throw new Error("Supabase context not initialised.");
    }
    return supabaseContext.supabase;
  }),
}));

const { GET: profileGet } = await import("@/pages/api/profile.ts");
const { PUT: personaPut } = await import("@/pages/api/profile/persona.ts");

function buildSupabaseContext(result: SupabaseMockState["maybeSingleResult"]): SupabaseMockContext {
  const state: SupabaseMockState = {
    maybeSingleResult: result,
    profileUpdates: [],
    uploads: [],
    authTokens: [],
  };

  const supabase: DatabaseClientMock = {
    auth: {
      getUser: async (token: string) => {
        state.authTokens.push(token);
        if (!result.data) {
          return { data: { user: { id: "user-" + token } }, error: null };
        }
        return { data: { user: { id: result.data.user_id } }, error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, data: Blob, options?: unknown) => {
          state.uploads.push({ bucket, path, options, data });
          return { data: null, error: null };
        },
      }),
    },
    from: (table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => state.maybeSingleResult,
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async (field: string, value: string) => {
            state.profileUpdates.push({ payload, filter: { field, value } });
            return { data: null, error: null };
          },
        }),
      };
    },
  };

  return { supabase, state };
}

beforeEach(() => {
  setTestEnvironment();
  supabaseContext = null;
  vi.mocked(imageSize).mockReturnValue({ width: 2048, height: 2048 });
  server?.use(
    http.post("https://example.invalid", () => HttpResponse.json({ ok: true })),
  );
});

afterEach(() => {
  supabaseContext = null;
  server?.resetHandlers();
  vi.clearAllMocks();
});

describe("/api/profile GET", () => {
  it("returns profile payload when found", async () => {
    const row: ProfileRow = {
      user_id: "user-123",
      consent_version: "v1",
      consent_accepted_at: "2024-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-02-01T00:00:00.000Z",
      persona_path: "users/user-123/persona.png",
      cloth_path: "users/user-123/garment.png",
      cloth_expires_at: "2024-02-02T00:00:00.000Z",
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: "2024-03-01T00:00:00.000Z",
    };

    supabaseContext = buildSupabaseContext({
      data: row,
      error: null,
      status: 200,
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer test-token" },
    });

    const response = await profileGet({ request } as any);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      userId: row.user_id,
      consent: {
        currentVersion: "v1",
        acceptedVersion: row.consent_version,
        acceptedAt: row.consent_accepted_at,
        isCompliant: true,
      },
    });
  });

  it("returns 204 when profile is missing", async () => {
    supabaseContext = buildSupabaseContext({
      data: null,
      error: null,
      status: 200,
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer test-token" },
    });

    const response = await profileGet({ request } as any);
    expect(response.status).toBe(204);
  });

  it("returns 403 when RLS denies access", async () => {
    supabaseContext = buildSupabaseContext({
      data: null,
      error: { message: "RLS denied", code: "PGRST301" },
      status: 403,
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer test-token" },
    });

    const response = await profileGet({ request } as any);
    expect(response.status).toBe(403);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toEqual({ error: "Forbidden" });
  });

  it("returns 401 when authorization header missing", async () => {
    const request = new Request("http://localhost/api/profile");
    const response = await profileGet({ request } as any);
    expect(response.status).toBe(401);
  });
});

describe("/api/profile/persona PUT", () => {
  it("stores persona asset and updates profile metadata", async () => {
    const row: ProfileRow = {
      user_id: "user-persona",
      consent_version: "v1",
      consent_accepted_at: "2024-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-03-01T00:00:00.000Z",
      persona_path: "users/user-persona/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseContext({
      data: row,
      error: null,
      status: 200,
    });

    const formData = new FormData();
    formData.set("persona", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "persona.png");
    formData.set("checksum", "manual-checksum");
    formData.set("width", "2048");
    formData.set("height", "2048");

    const request = new Request("http://localhost/api/profile/persona", {
      method: "PUT",
      headers: {
        Authorization: "Bearer persona-token",
      },
      body: formData,
    });

    const response = await personaPut({ request } as any);
    expect(response.status).toBe(201);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      persona: {
        path: expect.stringContaining("personas/user-persona/"),
        checksum: "manual-checksum",
        width: 2048,
        height: 2048,
        contentType: "image/png",
      },
    });

    expect(supabaseContext?.state.uploads).toHaveLength(1);
    expect(supabaseContext?.state.profileUpdates).toHaveLength(1);
  });

  it("rejects upload when user lacks consent", async () => {
    const row: ProfileRow = {
      user_id: "user-no-consent",
      consent_version: "v1",
      consent_accepted_at: "2023-01-01T00:00:00.000Z",
      created_at: "2023-01-01T00:00:00.000Z",
      updated_at: "2023-02-01T00:00:00.000Z",
      persona_path: null,
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseContext({
      data: {
        ...row,
        consent_version: "v0",
      },
      error: null,
      status: 200,
    });

    const formData = new FormData();
    formData.set("persona", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "persona.png");

    const request = new Request("http://localhost/api/profile/persona", {
      method: "PUT",
      headers: { Authorization: "Bearer persona-token" },
      body: formData,
    });

    const response = await personaPut({ request } as any);
    expect(response.status).toBe(403);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.error).toBe("Consent required.");
  });

  it("rejects persona upload when mime type unsupported", async () => {
    const row: ProfileRow = {
      user_id: "user-wrong-mime",
      consent_version: "v1",
      consent_accepted_at: "2024-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-02-01T00:00:00.000Z",
      persona_path: "users/user-wrong-mime/persona.png",
      cloth_path: null,
      cloth_expires_at: null,
      free_generation_quota: 5,
      free_generation_used: 1,
      quota_renewal_at: null,
    };

    supabaseContext = buildSupabaseContext({
      data: row,
      error: null,
      status: 200,
    });

    const formData = new FormData();
    formData.set("persona", new Blob([new Uint8Array([1, 2, 3])], { type: "image/gif" }), "persona.gif");

    const request = new Request("http://localhost/api/profile/persona", {
      method: "PUT",
      headers: { Authorization: "Bearer persona-token" },
      body: formData,
    });

    const response = await personaPut({ request } as any);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.error).toBe("Unsupported mime type.");
    expect(supabaseContext?.state.uploads).toHaveLength(0);
  });
});

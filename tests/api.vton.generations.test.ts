import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger.ts", () => {
  const createLogger = vi.fn(() => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
      withRequest: vi.fn(),
    };

    logger.child.mockReturnValue(logger);
    logger.withRequest.mockReturnValue(logger);
    return logger;
  });

  return { createLogger };
});

vi.mock("@/lib/multipart.ts", () => ({
  parseMultipartRequest: vi.fn(),
}));

vi.mock("@/lib/vton/config.ts", () => ({
  loadVtonEnvironmentConfig: vi.fn(),
}));

vi.mock("@/lib/vertex/vton.client.ts", () => {
  const VertexVtonClient = vi.fn().mockImplementation(() => {
    const instance = {
      enqueueJob: vi.fn(),
    };
    return instance;
  });

  return { VertexVtonClient };
});

vi.mock("@/lib/vton/generation.service.ts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/vton/generation.service.ts")>(
    "@/lib/vton/generation.service.ts"
  );

  return {
    ...actual,
    createGeneration: vi.fn(),
  };
});

const { createClient } = await import("@supabase/supabase-js");
const createClientMock = vi.mocked(createClient);

const { parseMultipartRequest } = await import("@/lib/multipart.ts");
const parseMultipartRequestMock = vi.mocked(parseMultipartRequest);

const { loadVtonEnvironmentConfig } = await import("@/lib/vton/config.ts");
const loadVtonEnvironmentConfigMock = vi.mocked(loadVtonEnvironmentConfig);

const { createGeneration, GenerationServiceError } = await import("@/lib/vton/generation.service.ts");
const createGenerationMock = vi.mocked(createGeneration);

const { POST } = await import("@/pages/api/vton/generations/index.ts");

describe("POST /api/vton/generations", () => {
  const supabaseUrl = "https://example.supabase.co";
  const supabaseKey = "test-anon-key";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = supabaseUrl;
    process.env.SUPABASE_KEY = supabaseKey;
    process.env.GOOGLE_VERTEX_API_KEY = "vertex-test-key";

    loadVtonEnvironmentConfigMock.mockReturnValue({
      vertexProjectId: "test-project",
      vertexLocation: "europe-west1",
      vertexModel: "virtual-try-on",
      garmentBucket: "garment-bucket",
      personaBucket: "persona-bucket",
      generationBucket: "generation-bucket",
      defaultEtaSeconds: 180,
      maxGarmentBytes: 7_340_032,
      minGarmentWidth: 1024,
      minGarmentHeight: 1024,
      allowedGarmentMimeTypes: ["image/png", "image/jpeg"],
    });
  });

  it("returns 401 when authorization header is missing", async () => {
    const request = new Request("http://localhost/api/vton/generations", { method: "POST" });

    const response = await POST({ request } as any);

    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("unauthorized");
    expect(parseMultipartRequestMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 401 when user session cannot be resolved", async () => {
    const supabaseAuthGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });
    createClientMock.mockReturnValue({ auth: { getUser: supabaseAuthGetUser } });

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("unauthorized");
    expect(parseMultipartRequestMock).not.toHaveBeenCalled();
  });

  it("returns 400 when consentVersion field is missing", async () => {
    const supabaseAuthGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    createClientMock.mockReturnValue({ auth: { getUser: supabaseAuthGetUser } });

    parseMultipartRequestMock.mockResolvedValue({
      fields: {},
      files: [],
    });

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe("invalid_request");
    expect(payload.error.message).toBe("consentVersion field is required.");
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  it("returns mapped error when retainForHours is invalid", async () => {
    const supabaseAuthGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    createClientMock.mockReturnValue({ auth: { getUser: supabaseAuthGetUser } });

    parseMultipartRequestMock.mockResolvedValue({
      fields: {
        consentVersion: ["v1"],
        retainForHours: ["not-a-number"],
      },
      files: [
        {
          fieldName: "garment",
          filename: "dress.png",
          mimeType: "image/png",
          encoding: "7bit",
          size: 1024,
          path: "/tmp/mock",
          toBlob: vi.fn().mockResolvedValue(new Blob()),
          cleanup: vi.fn(),
        },
      ],
    });

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("invalid_request");
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  it("cleans up files and propagates GenerationServiceError details", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);
    const toBlobMock = vi.fn().mockResolvedValue(new Blob());

    const supabaseAuthGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    createClientMock.mockReturnValue({ auth: { getUser: supabaseAuthGetUser } });

    parseMultipartRequestMock.mockResolvedValue({
      fields: {
        consentVersion: ["v1"],
        retainForHours: ["48"],
      },
      files: [
        {
          fieldName: "garment",
          filename: "dress.png",
          mimeType: "image/png",
          encoding: "7bit",
          size: 1024,
          path: "/tmp/mock",
          toBlob: toBlobMock,
          cleanup: cleanupMock,
        },
      ],
    });

    createGenerationMock.mockRejectedValue(
      new GenerationServiceError("Quota exhausted", {
        code: "quota_exhausted",
        httpStatus: 403,
        context: { remaining: 0 },
      })
    );

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(403);
    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe("quota_exhausted");
    expect(payload.error.message).toBe("Quota exhausted");
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(toBlobMock).toHaveBeenCalledTimes(1);
    expect(createGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        consentVersion: "v1",
        retainForHours: 48,
      }),
      expect.objectContaining({
        userId: "user-123",
      })
    );
  });

  it("returns 202 with Location header on success", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);
    const toBlobMock = vi.fn().mockResolvedValue(new Blob());

    const supabaseAuthGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    createClientMock.mockReturnValue({ auth: { getUser: supabaseAuthGetUser } });

    parseMultipartRequestMock.mockResolvedValue({
      fields: {
        consentVersion: ["v2"],
        retainForHours: ["24"],
      },
      files: [
        {
          fieldName: "garment",
          filename: "coat.png",
          mimeType: "image/png",
          encoding: "7bit",
          size: 512,
          path: "/tmp/mock",
          toBlob: toBlobMock,
          cleanup: cleanupMock,
        },
      ],
    });

    const queuedResponse = {
      id: "gen-789",
      status: "queued",
      vertexJobId: "vertex-job-001",
      etaSeconds: 200,
      createdAt: "2024-01-05T12:00:00.000Z",
      expiresAt: "2024-01-06T12:00:00.000Z",
      personaSnapshotPath: "persona/snapshot.png",
      clothSnapshotPath: "garments/coat.png",
      quota: {
        remainingFree: 3,
      },
    };

    createGenerationMock.mockResolvedValue(queuedResponse as any);

    const request = new Request("http://localhost/api/vton/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(202);
    expect(response.headers.get("Location")).toBe("/api/vton/generations/gen-789");
    const payload = (await response.json()) as typeof queuedResponse;
    expect(payload).toEqual(queuedResponse);
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(toBlobMock).toHaveBeenCalledTimes(1);
  });
});

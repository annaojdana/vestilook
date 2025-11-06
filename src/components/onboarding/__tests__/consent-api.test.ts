import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/db/supabase.client.ts", () => {
  const auth = {
    getSession: vi.fn(),
  };

  return {
    supabaseClient: {
      auth,
    },
  };
});

const { supabaseClient } = await import("@/db/supabase.client.ts");
const getSessionMock = vi.mocked(supabaseClient.auth.getSession);

const { fetchConsentStatus, submitConsentAcceptance } = await import("../consent-api.ts");
const { ConsentApiError } = await import("../consent-types.ts");

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

describe("consent-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
        },
      },
      error: null,
    });

    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps consent status payload to view model", async () => {
    const responseBody = {
      requiredVersion: "v2",
      acceptedVersion: "v1",
      acceptedAt: "2024-01-01T12:00:00.000Z",
      isCompliant: false,
      policyUrl: "https://vestilook.com/policy",
      policyContent: "<p>Policy</p>",
      metadata: {
        updatedAt: "2024-01-01T11:00:00.000Z",
        source: "gcp" as const,
      },
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    const result = await fetchConsentStatus();

    expect(result).toEqual({
      requiredVersion: "v2",
      acceptedVersion: "v1",
      acceptedAt: "2024-01-01T12:00:00.000Z",
      isCompliant: false,
      policyContent: "<p>Policy</p>",
      policyUrl: "https://vestilook.com/policy",
      metadata: {
        updatedAt: "2024-01-01T11:00:00.000Z",
        source: "gcp",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/profile/consent", {
      method: "GET",
      headers: {
        Authorization: "Bearer access-token",
      },
      credentials: "include",
      signal: undefined,
    });
  });

  it("sets defaults when optional fields are missing", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          requiredVersion: "v3",
          isCompliant: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const result = await fetchConsentStatus();

    expect(result.policyContent).toBe("");
    expect(result.policyUrl).toBe("#");
    expect(result.metadata).toEqual({
      updatedAt: undefined,
      source: "internal",
    });
  });

  it("throws ConsentApiError when session retrieval fails", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: "Session expired" },
    });

    const promise = fetchConsentStatus();

    await expect(promise).rejects.toBeInstanceOf(ConsentApiError);
    await expect(promise).rejects.toMatchObject({
      message: "Nie udało się pobrać danych sesji użytkownika.",
      code: "unauthorized",
      details: { cause: "Session expired" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates network errors as ConsentApiError", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(fetchConsentStatus()).rejects.toMatchObject({
      code: "network",
    });
  });

  it("throws when backend returns 204 with no content", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    await expect(fetchConsentStatus()).rejects.toMatchObject({
      code: "server_error",
      status: 204,
    });
  });

  it("returns consent submission receipt with created status", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          acceptedVersion: "v2",
          acceptedAt: "2024-01-02T10:00:00.000Z",
          expiresAt: "2024-02-02T10:00:00.000Z",
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const receipt = await submitConsentAcceptance(
      {
        version: "v2",
        accepted: true,
      },
      {}
    );

    expect(receipt).toEqual({
      acceptedVersion: "v2",
      acceptedAt: "2024-01-02T10:00:00.000Z",
      status: "created",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/profile/consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer access-token",
      },
      credentials: "include",
      body: JSON.stringify({
        version: "v2",
        accepted: true,
      }),
      signal: undefined,
    });
  });

  it("marks consent submission as updated when backend returns 200", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          acceptedVersion: "v3",
          acceptedAt: "2024-01-05T19:00:00.000Z",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const receipt = await submitConsentAcceptance(
      {
        version: "v3",
        accepted: true,
      },
      {}
    );

    expect(receipt.status).toBe("updated");
  });

  it("throws ConsentApiError when backend rejects submission", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", {
        status: 409,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    await expect(
      submitConsentAcceptance(
        {
          version: "v4",
          accepted: true,
        },
        {}
      )
    ).rejects.toMatchObject({
      code: "conflict",
      status: 409,
    });
  });

  it("throws when backend response is missing receipt details", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    await expect(
      submitConsentAcceptance(
        {
          version: "v5",
          accepted: true,
        },
        {}
      )
    ).rejects.toMatchObject({
      code: "server_error",
    });
  });
});

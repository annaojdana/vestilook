import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsentRequirement } from "@/types.ts";
import { useConsentRequirement } from "../persona/useConsentRequirement.ts";

let accessTokenResolver: () => Promise<string> = () => Promise.resolve("token-default");
const accessTokenSpy = vi.fn(() => accessTokenResolver());

vi.mock("@/components/onboarding/persona/session.ts", () => ({
  requireAccessToken: () => accessTokenSpy(),
  isAccessTokenError: (error: unknown) => Boolean((error as { code?: string } | null)?.code === "unauthorized"),
}));

const setAccessTokenResolver = (resolver: () => Promise<string>) => {
  accessTokenResolver = resolver;
};

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

const consentBase: ConsentRequirement = {
  requiredVersion: "v2",
  acceptedVersion: null,
  acceptedAt: null,
  isCompliant: false,
};

describe("useConsentRequirement", () => {
  beforeEach(() => {
    setAccessTokenResolver(() => Promise.resolve("token-xyz"));
    accessTokenSpy.mockClear();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests consent and updates state on success", async () => {
    setAccessTokenResolver(() => Promise.resolve("token-123"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ acceptedVersion: "v2", acceptedAt: "2024-01-01T00:00:00.000Z" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useConsentRequirement(consentBase));

    await act(async () => {
      const receipt = await result.current.requestConsent();
      expect(receipt).toMatchObject({
        acceptedVersion: "v2",
      });
    });

    expect(result.current.consent.acceptedVersion).toEqual("v2");
    expect(result.current.consent.isCompliant).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("surfaces conflict error when consent is already up to date", async () => {
    setAccessTokenResolver(() => Promise.resolve("token-123"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Consent already up to date." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useConsentRequirement(consentBase));

    await act(async () => {
      const receipt = await result.current.requestConsent();
      expect(receipt).toBeNull();
    });

    expect(result.current.error?.code).toBe("conflict");
    expect(result.current.consent.isCompliant).toBe(false);
  });
});

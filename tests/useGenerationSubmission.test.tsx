import { act, cleanup, render, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createRef, forwardRef, useImperativeHandle } from "react";

import { useGenerationSubmission, type UseGenerationSubmissionResult } from "@/components/generations/hooks/useGenerationSubmission.ts";
import type { ConsentFormState, GarmentFileState, GenerationSubmissionResult } from "@/components/generations/types.ts";
import type { ProfileResponseDto } from "@/types.ts";

vi.mock("@/components/onboarding/persona/session.ts", () => ({
  requireAccessToken: vi.fn(),
}));

const { requireAccessToken } = await import("@/components/onboarding/persona/session.ts");
const requireAccessTokenMock = vi.mocked(requireAccessToken);

const baseProfile: ProfileResponseDto = {
  userId: "user-123",
  persona: null,
  consent: {
    currentVersion: "v1",
    acceptedVersion: "v1",
    acceptedAt: "2024-01-01T00:00:00.000Z",
    isCompliant: true,
  },
  quota: {
    free: {
      total: 5,
      used: 1,
      remaining: 4,
      renewsAt: "2024-02-01T00:00:00.000Z",
    },
  },
  clothCache: {
    path: "cloths/latest.png",
    expiresAt: "2024-02-10T00:00:00.000Z",
  },
};

const garmentState: GarmentFileState = {
  file: new File(["garment"], "garment.png", { type: "image/png" }),
  previewUrl: "blob:garment",
  width: 1400,
  height: 1600,
};

const consentState: ConsentFormState = {
  currentVersion: "v1",
  acceptedVersion: "v1",
  acceptedAt: "2024-01-01T00:00:00.000Z",
  isCompliant: true,
  checkboxChecked: true,
};

const HookHarness = forwardRef<UseGenerationSubmissionResult, { profile: ProfileResponseDto }>(
  ({ profile }, ref) => {
    const hook = useGenerationSubmission({ profile });
    useImperativeHandle(ref, () => hook, [hook]);
    return null;
  }
);
HookHarness.displayName = "GenerationSubmissionHarness";

describe("useGenerationSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    requireAccessTokenMock.mockResolvedValue("token-abc");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("queues generation successfully without consent refresh", async () => {
    const generationPayload: GenerationSubmissionResult = {
      id: "gen-001",
      quota: {
        remainingFree: 3,
      },
      etaSeconds: 180,
    };

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/vton/generations") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: generationPayload.id,
            status: "queued",
            vertexJobId: "vertex-001",
            etaSeconds: generationPayload.etaSeconds,
            quota: {
              remainingFree: generationPayload.quota.remainingFree,
            },
            createdAt: "2024-01-05T12:00:00.000Z",
            personaSnapshotPath: "persona/snapshot.png",
            clothSnapshotPath: "cloth/snapshot.png",
            expiresAt: "2024-01-06T12:00:00.000Z",
          }),
          {
            status: 202,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    const ref = createRef<UseGenerationSubmissionResult>();
    render(<HookHarness profile={baseProfile} ref={ref} />);
    await waitFor(() => expect(ref.current).not.toBeNull());

    let result: GenerationSubmissionResult | null = null;
    await act(async () => {
      const outcome = await ref.current!.submitGeneration({
        garment: garmentState,
        consent: consentState,
        retainForHours: 48,
      });
      result = outcome?.generation ?? null;
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(generationPayload.id);
    expect(ref.current?.profile.quota.free.remaining).toBe(generationPayload.quota.remainingFree);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requireAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(ref.current?.error).toBeNull();
  });

  it("refreshes consent when outdated before queuing generation", async () => {
    const profile: ProfileResponseDto = {
      ...baseProfile,
      consent: {
        ...baseProfile.consent,
        isCompliant: false,
        acceptedVersion: "v0",
      },
    };

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/api/profile/consent") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            acceptedVersion: "v1",
            acceptedAt: "2024-01-05T12:00:00.000Z",
            expiresAt: "2024-02-01T00:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/api/vton/generations") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "gen-002",
            status: "queued",
            vertexJobId: "vertex-002",
            etaSeconds: 200,
            quota: { remainingFree: 2 },
            createdAt: "2024-01-06T08:00:00.000Z",
            personaSnapshotPath: "persona/snapshot.png",
            clothSnapshotPath: "cloth/snapshot.png",
            expiresAt: "2024-01-07T08:00:00.000Z",
          }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    const ref = createRef<UseGenerationSubmissionResult>();
    render(<HookHarness profile={profile} ref={ref} />);
    await waitFor(() => expect(ref.current).not.toBeNull());

    await act(async () => {
      await ref.current!.submitGeneration({
        garment: garmentState,
        consent: { ...consentState, isCompliant: false, acceptedVersion: "v0" },
        retainForHours: 24,
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requireAccessTokenMock).toHaveBeenCalledTimes(2);
    expect(ref.current?.profile.consent.acceptedVersion).toBe("v1");
    expect(ref.current?.profile.quota.free.remaining).toBe(2);
  });

  it("surfaces API errors with mapped codes", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/vton/generations") && init?.method === "POST") {
        return new Response(JSON.stringify({ message: "Quota exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    const ref = createRef<UseGenerationSubmissionResult>();
    render(<HookHarness profile={baseProfile} ref={ref} />);
    await waitFor(() => expect(ref.current).not.toBeNull());

    await act(async () => {
      const outcome = await ref.current!.submitGeneration({
        garment: garmentState,
        consent: consentState,
        retainForHours: 48,
      });
      expect(outcome).toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ref.current?.error?.code).toBe("quota_exhausted");
    expect(ref.current?.error?.message).toContain("Quota exceeded");
  });
});

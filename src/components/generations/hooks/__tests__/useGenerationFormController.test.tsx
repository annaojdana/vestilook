/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConsentUpsertResponseDto, ProfileResponseDto } from "@/types.ts";

import { useGenerationFormController } from "../useGenerationFormController.ts";

const BASE_PROFILE: ProfileResponseDto = {
  userId: "user-1",
  persona: null,
  consent: {
    currentVersion: "v1",
    acceptedVersion: null,
    acceptedAt: null,
    isCompliant: false,
  },
  quota: {
    free: {
      total: 3,
      remaining: 2,
      used: 1,
      renewsAt: new Date().toISOString(),
    },
  },
  clothCache: {
    path: null,
    expiresAt: null,
  },
};

describe("useGenerationFormController", () => {
  it("initialises state from profile snapshot", () => {
    const { result } = renderHook(() =>
      useGenerationFormController({
        profile: BASE_PROFILE,
        retention: 48,
      }),
    );

    expect(result.current.state.retainForHours).toBe(48);
    expect(result.current.state.quota.remaining).toBe(2);
    expect(result.current.state.consent.currentVersion).toBe("v1");
    expect(result.current.state.status).toBe("idle");
  });

  it("syncs consent snapshot and resets checkbox when compliance changes", () => {
    const { result } = renderHook(() =>
      useGenerationFormController({
        profile: BASE_PROFILE,
        retention: 48,
      }),
    );

    act(() => {
      result.current.actions.setConsentChecked(true);
      result.current.actions.syncProfile({
        ...BASE_PROFILE,
        consent: {
          currentVersion: "v2",
          acceptedVersion: null,
          acceptedAt: null,
          isCompliant: false,
        },
      });
    });

    expect(result.current.state.consent.currentVersion).toBe("v2");
    expect(result.current.state.consent.checkboxChecked).toBe(false);
  });

  it("applies submission success and marks consent compliant", () => {
    const { result } = renderHook(() =>
      useGenerationFormController({
        profile: BASE_PROFILE,
        retention: 24,
      }),
    );

    const nextProfile: ProfileResponseDto = {
      ...BASE_PROFILE,
      quota: {
        free: {
          total: 3,
          remaining: 1,
          used: 2,
          renewsAt: new Date().toISOString(),
        },
      },
    };

    const receipt: ConsentUpsertResponseDto = {
      acceptedVersion: "v2",
      acceptedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };

    act(() => {
      result.current.actions.applySubmissionSuccess({
        profile: nextProfile,
        consentReceipt: receipt,
      });
    });

    expect(result.current.state.status).toBe("success");
    expect(result.current.state.consent.acceptedVersion).toBe("v2");
    expect(result.current.state.consent.checkboxChecked).toBe(true);
    expect(result.current.state.quota.remaining).toBe(1);
  });
});

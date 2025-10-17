import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  PersonaAssetMetadata,
  PersonaUploadResponseDto,
  ProfileResponseDto,
  ConsentReceipt,
} from "@/types.ts";
import { usePersonaProfile } from "../persona/usePersonaProfile.ts";

const baseProfile: ProfileResponseDto = {
  userId: "user-123",
  persona: null,
  consent: {
    currentVersion: "v2",
    acceptedVersion: null,
    acceptedAt: null,
    isCompliant: false,
  },
  quota: {
    free: {
      total: 10,
      used: 0,
      remaining: 10,
      renewsAt: null,
    },
  },
  clothCache: {
    path: "garments/user-123",
    expiresAt: null,
  },
};

const personaAsset: PersonaAssetMetadata = {
  path: "personas/user-123/test-persona.jpg",
  updatedAt: "2024-01-01T00:00:00.000Z",
  width: 2048,
  height: 2048,
  contentType: "image/jpeg",
  checksum: "abc123",
};

const uploadResponse: PersonaUploadResponseDto = {
  persona: {
    ...personaAsset,
    checksum: "upload-checksum",
  },
  consent: {
    requiredVersion: "v2",
    acceptedVersion: "v2",
    acceptedAt: "2024-01-02T10:00:00.000Z",
  },
};

describe("usePersonaProfile", () => {
  it("initializes view model from null profile", () => {
    const { result } = renderHook(() => usePersonaProfile(null));

    expect(result.current.viewModel.persona).toBeNull();
    expect(result.current.viewModel.canContinue).toBe(false);
    expect(result.current.viewModel.consent.isCompliant).toBe(false);
  });

  it("applies upload response to persona and consent snapshots", () => {
    const { result } = renderHook(() => usePersonaProfile(baseProfile));

    act(() => {
      result.current.applyUploadResponse(uploadResponse);
    });

    expect(result.current.viewModel.persona?.path).toEqual(uploadResponse.persona.path);
    expect(result.current.viewModel.persona?.checksum).toEqual(uploadResponse.persona.checksum);
    expect(result.current.viewModel.consent.acceptedVersion).toEqual("v2");
    expect(result.current.viewModel.consent.isCompliant).toBe(true);
    expect(result.current.viewModel.canContinue).toBe(true);
  });

  it("updates consent snapshot on receipt", () => {
    const { result } = renderHook(() => usePersonaProfile(baseProfile));

    const receipt: ConsentReceipt = {
      acceptedVersion: "v2",
      acceptedAt: "2024-01-02T10:00:00.000Z",
      expiresAt: null,
    };

    act(() => {
      result.current.applyConsentReceipt(receipt);
    });

    expect(result.current.viewModel.consent.acceptedVersion).toEqual("v2");
    expect(result.current.viewModel.consent.acceptedAt).toEqual(receipt.acceptedAt);
    expect(result.current.viewModel.consent.isCompliant).toBe(true);
  });

  it("resets persona when profile snapshot becomes null", () => {
    const { result } = renderHook(() => usePersonaProfile(baseProfile));

    act(() => {
      result.current.applyPersonaUpdate(personaAsset);
    });

    expect(result.current.viewModel.persona).not.toBeNull();

    act(() => {
      result.current.applyProfileSnapshot(null);
    });

    expect(result.current.viewModel.persona).toBeNull();
    expect(result.current.viewModel.canContinue).toBe(false);
  });
});

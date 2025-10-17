import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import GenerationForm from "@/components/generations/GenerationForm.tsx";
import type { GarmentFileState, GenerationSubmissionResult, UseGenerationSubmissionResult } from "@/components/generations/types.ts";
import type { ImageValidationConstraints, ProfileResponseDto } from "@/types.ts";

vi.mock("@/components/generations/hooks/useGarmentValidation.ts", () => ({
  useGarmentValidation: vi.fn(),
}));

vi.mock("@/components/generations/hooks/useGenerationSubmission.ts", () => ({
  useGenerationSubmission: vi.fn(),
}));

const { useGarmentValidation } = await import("@/components/generations/hooks/useGarmentValidation.ts");
const { useGenerationSubmission } = await import("@/components/generations/hooks/useGenerationSubmission.ts");
const useGarmentValidationMock = vi.mocked(useGarmentValidation);
const useGenerationSubmissionMock = vi.mocked(useGenerationSubmission);

const baseConstraints: ImageValidationConstraints = {
  minWidth: 1024,
  minHeight: 1024,
  maxBytes: 7_340_032,
  allowedMimeTypes: ["image/jpeg", "image/png"],
};

const baseProfile: ProfileResponseDto = {
  userId: "user-123",
  persona: {
    path: "persona.jpg",
    updatedAt: "2024-01-01T00:00:00.000Z",
    width: 1024,
    height: 1536,
    contentType: "image/jpeg",
  },
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
    path: "cache.png",
    expiresAt: "2024-02-02T00:00:00.000Z",
  },
};

const createGarmentState = (): GarmentFileState => ({
  file: new File(["mock"], "garment.png", { type: "image/png" }),
  previewUrl: "blob:garment",
  width: 1400,
  height: 1800,
});

function createFileList(file: File | null): FileList | null {
  if (!file) {
    return null;
  }

  const items = [file];

  return {
    0: file,
    length: items.length,
    item: (index: number) => items[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* items;
    },
  } as unknown as FileList;
}

function cloneProfile(profile: ProfileResponseDto): ProfileResponseDto {
  return JSON.parse(JSON.stringify(profile)) as ProfileResponseDto;
}

describe("GenerationForm", () => {
  let validateSpy: ReturnType<typeof vi.fn>;
  let resetValidationSpy: ReturnType<typeof vi.fn>;
  let submissionStub: UseGenerationSubmissionResult;
  let submitGenerationSpy: ReturnType<typeof vi.fn>;
  let resetSubmissionErrorSpy: ReturnType<typeof vi.fn>;
  let profileSnapshot: ProfileResponseDto;
  let garmentState: GarmentFileState;

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(globalThis.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    garmentState = createGarmentState();
    validateSpy = vi.fn().mockResolvedValue(garmentState);
    resetValidationSpy = vi.fn();
    profileSnapshot = cloneProfile(baseProfile);

    submitGenerationSpy = vi.fn().mockResolvedValue({
      generation: {
        id: "gen-123",
        quota: {
          remainingFree: 3,
        },
        etaSeconds: 180,
      },
      payload: {
        id: "gen-123",
        status: "queued",
        vertexJobId: "vertex-123",
        etaSeconds: 180,
        quota: {
          remainingFree: 3,
        },
        createdAt: "2024-02-01T10:00:00.000Z",
        personaSnapshotPath: "persona/snap.png",
        clothSnapshotPath: "cloth/snap.png",
        expiresAt: "2024-02-02T10:00:00.000Z",
      },
      consentReceipt: null,
      refreshedProfile: null,
    });

    resetSubmissionErrorSpy = vi.fn();

    submissionStub = {
      profile: profileSnapshot,
      submitting: false,
      updatingConsent: false,
      error: null,
      submitGeneration: submitGenerationSpy,
      updateConsentIfRequired: vi.fn(),
      refreshProfile: vi.fn(),
      resetError: resetSubmissionErrorSpy,
    };

    useGarmentValidationMock.mockReturnValue({
      validating: false,
      error: null,
      validate: validateSpy,
      resetError: resetValidationSpy,
    });

    useGenerationSubmissionMock.mockReturnValue(submissionStub);
  });

  afterEach(() => {
    cleanup();
  });

  it("enables wysyłkę dopiero po dodaniu pliku i zaznaczeniu zgody", async () => {
    const onSuccess = vi.fn();
    render(
      <GenerationForm
        initialProfile={profileSnapshot}
        constraints={baseConstraints}
        consentPolicyUrl="https://policy.test"
        onSuccess={onSuccess}
      />
    );

    const submitButton = screen.getByRole("button", { name: /Generuj stylizację/i });
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    const [fileInput] = screen.getAllByLabelText(/Wybierz plik/i);
    fireEvent.change(fileInput, { target: { files: createFileList(garmentState.file) } });

    await waitFor(() => expect(validateSpy).toHaveBeenCalled());
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    const consentCheckbox = screen.getByRole("checkbox", { name: /Akceptuję aktualną politykę/i });
    fireEvent.click(consentCheckbox);

    await waitFor(() => expect(submitButton.hasAttribute("disabled")).toBe(false));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("wywołuje submitGeneration i onSuccess w szczęśliwym scenariuszu", async () => {
    const onSuccess = vi.fn();
    render(
      <GenerationForm
        initialProfile={profileSnapshot}
        constraints={baseConstraints}
        consentPolicyUrl="https://policy.test"
        onSuccess={onSuccess}
      />
    );

    const [fileInput] = screen.getAllByLabelText(/Wybierz plik/i);
    fireEvent.change(fileInput, { target: { files: createFileList(garmentState.file) } });

    await waitFor(() => expect(validateSpy).toHaveBeenCalledTimes(1));

    const consentCheckbox = screen.getByRole("checkbox", { name: /Akceptuję aktualną politykę/i });
    fireEvent.click(consentCheckbox);

    const submitButton = screen.getByRole("button", { name: /Generuj stylizację/i });
    await waitFor(() => expect(submitButton.hasAttribute("disabled")).toBe(false));

    fireEvent.click(submitButton);

    await waitFor(() => expect(submitGenerationSpy).toHaveBeenCalledTimes(1));
    expect(submitGenerationSpy).toHaveBeenCalledWith({
      garment: garmentState,
      consent: expect.objectContaining({ checkboxChecked: true }),
      retainForHours: 48,
    });
    expect(onSuccess).toHaveBeenCalledWith("gen-123");
  });

  it("blokuje wysyłkę i pokazuje alert quota przy braku limitu", async () => {
    profileSnapshot.quota.free.remaining = 0;
    submissionStub.profile = profileSnapshot;
    useGenerationSubmissionMock.mockReturnValueOnce(submissionStub);

    render(
      <GenerationForm
        initialProfile={profileSnapshot}
        constraints={baseConstraints}
        consentPolicyUrl="https://policy.test"
      />
    );

    const quotaAlert = await screen.findByText(/Brak dostępnych generacji/i);
    expect(Boolean(quotaAlert)).toBe(true);
    const submitButton = screen.getByRole("button", { name: /Generuj stylizację/i });
    expect(submitButton.hasAttribute("disabled")).toBe(true);
  });
});

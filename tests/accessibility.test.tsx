import React, { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import GenerationForm from "@/components/generations/GenerationForm.tsx";
import type { GarmentFileState, UseGenerationSubmissionResult } from "@/components/generations/types.ts";
import type { ImageValidationConstraints, ProfileResponseDto } from "@/types.ts";
import ConsentFormSection from "@/components/onboarding/ConsentFormSection.tsx";
import type { ConsentViewModel } from "@/components/onboarding/consent-types.ts";

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
    path: null,
    expiresAt: null,
  },
};

const createGarmentState = (): GarmentFileState => ({
  file: new File(["mock"], "garment.png", { type: "image/png" }),
  previewUrl: "blob:garment",
  width: 1400,
  height: 1800,
});

describe("Accessibility checks", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("GenerationForm", () => {
    beforeEach(() => {
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

      const garmentState = createGarmentState();

      useGarmentValidationMock.mockReturnValue({
        validating: false,
        error: null,
        validate: vi.fn().mockResolvedValue(garmentState),
        resetError: vi.fn(),
      });

      const submissionStub: UseGenerationSubmissionResult = {
        profile: baseProfile,
        submitting: false,
        updatingConsent: false,
        error: null,
        submitGeneration: vi.fn().mockResolvedValue(null),
        updateConsentIfRequired: vi.fn(),
        refreshProfile: vi.fn(),
        resetError: vi.fn(),
      };

      useGenerationSubmissionMock.mockReturnValue(submissionStub);
    });

    it("has no detectable accessibility violations", async () => {
      const { container } = render(
        <GenerationForm
          initialProfile={baseProfile}
          constraints={baseConstraints}
          consentPolicyUrl="https://policy.test"
          onSuccess={vi.fn()}
        />,
      );

      const results = await axe(container, {
        rules: {
          "color-contrast": { enabled: false },
          "heading-order": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });
  });

  describe("ConsentFormSection", () => {
    const viewModel: ConsentViewModel = {
      requiredVersion: "v1",
      acceptedVersion: "v0",
      acceptedAt: "2024-01-01T00:00:00.000Z",
      isCompliant: false,
      policyContent: "",
      policyUrl: "https://policy.test",
      metadata: {
        source: "internal",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };

    const feedbackRef = createRef<HTMLDivElement>();
    const noop = () => {};

    it("passes axe checks", async () => {
      const { container } = render(
        <ConsentFormSection
          viewModel={viewModel}
          checked={false}
          disabled={false}
          isSubmitting={false}
          showValidationError={false}
          error={null}
          feedbackId="consent-feedback"
          descriptionId="consent-description"
          feedbackRef={feedbackRef}
          onCheckedChange={noop}
          onSubmit={noop}
          onRetry={noop}
        />,
      );

      const results = await axe(container, {
        rules: {
          "color-contrast": { enabled: false },
          "heading-order": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });
  });
});

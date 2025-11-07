import { useCallback, useEffect, useMemo, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { ImageValidationConstraints, ProfileResponseDto } from "@/types.ts";

import { ConsentReaffirmation } from "./ConsentReaffirmation.tsx";
import { FormAlerts } from "./FormAlerts.tsx";
import { GarmentUploadField } from "./GarmentUploadField.tsx";
import { GeneratePrimaryButton } from "./GeneratePrimaryButton.tsx";
import { QuotaIndicator } from "./QuotaIndicator.tsx";
import { RetentionSelector } from "./RetentionSelector.tsx";
import { useGarmentValidation } from "./hooks/useGarmentValidation.ts";
import { useGenerationSubmission } from "./hooks/useGenerationSubmission.ts";
import type { GenerationErrorState } from "./types.ts";
import {
  createFormError,
  normalizeDetailsBasePath,
  normalizeRetentionValue,
  RETENTION_ALLOWED_VALUES,
  RETENTION_OPTIONS,
  useGenerationFormController,
} from "./hooks/useGenerationFormController.ts";

export interface GenerationFormProps {
  initialProfile: ProfileResponseDto;
  constraints: ImageValidationConstraints;
  consentPolicyUrl: string;
  defaultRetention?: number;
  detailsBasePath?: string;
  onSuccess?(generationId: string): void;
}

interface GenerationFormFields {
  retainForHours: number;
  consentChecked: boolean;
}

export default function GenerationForm({
  initialProfile,
  constraints,
  consentPolicyUrl,
  defaultRetention,
  detailsBasePath,
  onSuccess,
}: GenerationFormProps) {
  const retention = useMemo(() => normalizeRetentionValue(defaultRetention), [defaultRetention]);
  const form = useForm<GenerationFormFields>({
    mode: "onChange",
    defaultValues: {
      retainForHours: retention,
      consentChecked: false,
    },
  });

  const submission = useGenerationSubmission({ profile: initialProfile });
  const garmentValidation = useGarmentValidation(constraints);

  const previousUserIdRef = useRef(initialProfile.userId);
  const previousPreviewUrl = useRef<string | null>(null);

  const basePath = useMemo(() => normalizeDetailsBasePath(detailsBasePath), [detailsBasePath]);
  const { state, actions } = useGenerationFormController({
    profile: initialProfile,
    retention,
  });
  const consentRequiresUpdate =
    !state.consent.isCompliant || state.consent.acceptedVersion !== state.consent.currentVersion;
  const quotaLocked = state.quota.hardLimitReached || state.quota.remaining <= 0;
  const submitDisabled =
    submission.submitting ||
    garmentValidation.validating ||
    !state.garment ||
    quotaLocked ||
    !state.consent.checkboxChecked;

  useEffect(() => {
    if (previousUserIdRef.current === initialProfile.userId) {
      return;
    }

    previousUserIdRef.current = initialProfile.userId;
    actions.resetState(initialProfile, retention);
    form.reset({
      retainForHours: retention,
      consentChecked: false,
    });
  }, [actions, form, initialProfile, retention]);

  useEffect(() => {
    form.setValue("retainForHours", state.retainForHours, { shouldDirty: false });
  }, [form, state.retainForHours]);

  useEffect(() => {
    form.setValue("consentChecked", state.consent.checkboxChecked, { shouldDirty: false });
  }, [form, state.consent.checkboxChecked]);

  useEffect(() => {
    actions.syncProfile(submission.profile);
  }, [actions, submission.profile]);

  useEffect(() => {
    if (!submission.error) {
      return;
    }

    actions.setError(submission.error);
    actions.setStatus("error");
  }, [actions, submission.error]);

  useEffect(() => {
    if (!garmentValidation.error) {
      if (state.status === "error" && !state.error) {
        actions.setStatus("idle");
      }
      return;
    }

    actions.setStatus("error");
  }, [actions, garmentValidation.error, state.error, state.status]);

  useEffect(() => {
    if (submission.submitting) {
      actions.setStatus("submitting");
      return;
    }

    if (garmentValidation.validating) {
      actions.setStatus("validating");
      return;
    }

    if (state.status === "submitting" || state.status === "validating") {
      actions.setStatus(state.error ? "error" : "idle");
    }
  }, [actions, garmentValidation.validating, state.error, state.status, submission.submitting]);

  useEffect(() => {
    const previousUrl = previousPreviewUrl.current;
    const nextUrl = state.garment?.previewUrl ?? null;

    if (previousUrl && previousUrl !== nextUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    previousPreviewUrl.current = nextUrl;

    return () => {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [state.garment]);

  const handleGarmentChange = useCallback(
    async (files: FileList | null) => {
      submission.resetError();
      garmentValidation.resetError();
      actions.setError(null);

      const validated = await garmentValidation.validate(files);

      actions.setGarment(validated ?? null);
      actions.setStatus(
        validated ? (state.status === "success" ? "success" : "idle") : "error",
      );
    },
    [actions, garmentValidation, state.status, submission],
  );

  const handleGarmentClear = useCallback(() => {
    garmentValidation.resetError();
    submission.resetError();
    actions.setGarment(null);
    actions.setError(null);
    actions.setStatus(state.status === "success" ? "success" : "idle");
  }, [actions, garmentValidation, state.status, submission]);

  const handleConsentToggle = useCallback(
    (checked: boolean) => {
      submission.resetError();
      actions.setError(null);
      actions.setConsentChecked(checked);
      form.setValue("consentChecked", checked, { shouldDirty: true });
      if (checked) {
        form.clearErrors("consentChecked");
      }
      actions.setStatus(checked ? (state.status === "success" ? "success" : "idle") : "error");
    },
    [actions, form, state.status, submission],
  );

  const handleRetentionChange = useCallback((value: number) => {
    if (!RETENTION_ALLOWED_VALUES.includes(value as (typeof RETENTION_ALLOWED_VALUES)[number])) {
      return;
    }

    form.setValue("retainForHours", value, { shouldDirty: true });
    actions.setRetentionValue(value);
    actions.setError(null);
    if (state.status === "error" && !state.error) {
      actions.setStatus("idle");
    }
  }, [actions, form, state.error, state.status]);

  const handleSubmit = useMemo(
    () =>
      form.handleSubmit(async () => {
        submission.resetError();
        garmentValidation.resetError();
        actions.setError(null);
        actions.setStatus(state.status === "success" ? "success" : "idle");

        const { garment, consent, quota, retainForHours } = state;

        if (!garment) {
          const nextError = createFormError(
            "garment_missing",
            "Dodaj zdjęcie ubrania przed uruchomieniem generacji.",
            "garment",
          );
          actions.setError(nextError);
          actions.setStatus("error");
          return;
        }

        if (!consent.checkboxChecked) {
          const consentError = createFormError(
            "consent_unchecked",
            "Potwierdź zgodę na przetwarzanie wizerunku, aby kontynuować.",
            "consent",
          );
          actions.setError(consentError);
          actions.setStatus("error");
          form.setError("consentChecked", { type: "manual", message: consentError.message });
          return;
        }

        if (quota.hardLimitReached || quota.remaining <= 0) {
          const quotaError = createFormError(
            "quota_exhausted",
            "Limit darmowych generacji został wykorzystany. Odczekaj do odnowienia puli.",
            "form",
          );
          actions.setError(quotaError);
          actions.setStatus("error");
          return;
        }

        const outcome = await submission.submitGeneration({
          garment,
          consent,
          retainForHours,
        });

        if (!outcome) {
          actions.setStatus("error");
          return;
        }

        const updatedProfile = outcome.refreshedProfile ?? submission.profile;
        actions.applySubmissionSuccess({
          profile: updatedProfile,
          consentReceipt: outcome.consentReceipt,
        });

        const targetPath = `${basePath}/${outcome.generation.id}`;
        if (onSuccess) {
          onSuccess(outcome.generation.id);
        } else if (typeof window !== "undefined") {
          window.location.assign(targetPath);
        }
      }),
    [
      actions,
      basePath,
      form,
      garmentValidation,
      onSuccess,
      state,
      submission,
    ],
  );

  return (
    <FormProvider {...form}>
      <form className="flex flex-col gap-8" onSubmit={handleSubmit} data-testid="generation-form">
        <QuotaIndicator quota={state.quota} />
        <GarmentUploadField
          value={state.garment}
          error={garmentValidation.error}
          validating={garmentValidation.validating}
          constraints={constraints}
          onFileSelect={handleGarmentChange}
          onClear={handleGarmentClear}
        />
        <ConsentReaffirmation
          state={state.consent}
          onToggle={handleConsentToggle}
          policyUrl={consentPolicyUrl}
          disabled={submission.submitting}
        />
        <RetentionSelector
          value={state.retainForHours}
          options={RETENTION_OPTIONS}
          disabled={submission.submitting}
          onChange={handleRetentionChange}
        />
        <FormAlerts
          status={state.status}
          formError={submission.error ?? state.error}
          garmentError={garmentValidation.error}
          quotaLocked={quotaLocked}
          consentOutdated={consentRequiresUpdate && !state.consent.checkboxChecked}
        />
        <div className="flex justify-end">
          <GeneratePrimaryButton
            disabled={submitDisabled}
            loading={submission.submitting}
            remainingQuota={state.quota.remaining}
          />
        </div>
      </form>
    </FormProvider>
  );
}

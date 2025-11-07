import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { ImageValidationConstraints, ProfileResponseDto } from "@/types.ts";

import { ConsentReaffirmation } from "./ConsentReaffirmation.tsx";
import { FormAlerts } from "./FormAlerts.tsx";
import { GarmentUploadField } from "./GarmentUploadField.tsx";
import { GeneratePrimaryButton } from "./GeneratePrimaryButton.tsx";
import { QuotaIndicator } from "./QuotaIndicator.tsx";
import { RetentionSelector } from "./RetentionSelector.tsx";
import { useGarmentValidation } from "./hooks/useGarmentValidation.ts";
import { useGenerationSubmission } from "./hooks/useGenerationSubmission.ts";
import {
  type ConsentFormState,
  type GenerationFormState,
  type GenerationErrorState,
  type QuotaViewModel,
  type RetentionOption,
} from "./types.ts";

export interface GenerationFormProps {
  initialProfile: ProfileResponseDto;
  constraints: ImageValidationConstraints;
  consentPolicyUrl: string;
  defaultRetention?: number;
  detailsBasePath?: string;
  onSuccess?(generationId: string): void;
}

const RETENTION_ALLOWED_VALUES = [24, 48, 72] as const;
const DEFAULT_RETENTION = 48;
const RETENTION_OPTIONS: RetentionOption[] = [
  {
    value: 24,
    label: "24 godziny",
    description: "Idealne dla szybkich iteracji. Wyniki znikną w ciągu doby.",
  },
  {
    value: 48,
    label: "48 godzin",
    description: "Domyślna retencja. Masz dwa dni na pobranie efektów.",
  },
  {
    value: 72,
    label: "72 godziny",
    description: "Maksymalny czas przechowywania w ramach planu podstawowego.",
  },
];

export default function GenerationForm({
  initialProfile,
  constraints,
  consentPolicyUrl,
  defaultRetention,
  detailsBasePath,
  onSuccess,
}: GenerationFormProps) {
  const retention = useMemo(() => normalizeRetentionValue(defaultRetention), [defaultRetention]);
  const [formState, setFormState] = useState<GenerationFormState>(() =>
    createInitialFormState(initialProfile, retention)
  );

  const submission = useGenerationSubmission({ profile: initialProfile });
  const garmentValidation = useGarmentValidation(constraints);

  const previousUserIdRef = useRef(initialProfile.userId);
  const previousPreviewUrl = useRef<string | null>(null);

  const basePath = useMemo(() => normalizeDetailsBasePath(detailsBasePath), [detailsBasePath]);
  const consentRequiresUpdate =
    !formState.consent.isCompliant || formState.consent.acceptedVersion !== formState.consent.currentVersion;
  const quotaLocked = formState.quota.hardLimitReached || formState.quota.remaining <= 0;
  const submitDisabled =
    submission.submitting ||
    garmentValidation.validating ||
    !formState.garment ||
    quotaLocked ||
    !formState.consent.checkboxChecked;

  useEffect(() => {
    if (previousUserIdRef.current === initialProfile.userId) {
      return;
    }

    previousUserIdRef.current = initialProfile.userId;
    setFormState(createInitialFormState(initialProfile, retention));
  }, [initialProfile.userId, retention]);

  useEffect(() => {
    setFormState((current) => {
      if (current.retainForHours === retention) {
        return current;
      }

      return {
        ...current,
        retainForHours: retention,
      };
    });
  }, [retention]);

  useEffect(() => {
    setFormState((current) => {
      const nextQuota = mapQuotaViewModel(submission.profile);
      const nextConsentSnapshot = submission.profile.consent;
      const quotaChanged = hasQuotaChanged(current.quota, nextQuota);
      const consentChanged = hasConsentChanged(current.consent, nextConsentSnapshot);

      if (!quotaChanged && !consentChanged) {
        return current;
      }

      return {
        ...current,
        quota: quotaChanged ? nextQuota : current.quota,
        consent: consentChanged
          ? {
              ...current.consent,
              currentVersion: nextConsentSnapshot.currentVersion,
              acceptedVersion: nextConsentSnapshot.acceptedVersion,
              acceptedAt: nextConsentSnapshot.acceptedAt,
              isCompliant: nextConsentSnapshot.isCompliant,
              checkboxChecked: nextConsentSnapshot.isCompliant ? current.consent.checkboxChecked : false,
            }
          : current.consent,
      };
    });
  }, [submission.profile]);

  useEffect(() => {
    if (!submission.error) {
      return;
    }

    setFormState((current) => {
      if (current.error === submission.error && current.status === "error") {
        return current;
      }

      return {
        ...current,
        status: "error",
        error: submission.error,
      };
    });
  }, [submission.error]);

  useEffect(() => {
    if (!garmentValidation.error) {
      setFormState((current) => {
        if (current.status !== "error" || current.error) {
          return current;
        }

        return {
          ...current,
          status: "idle",
        };
      });
      return;
    }

    setFormState((current) => {
      if (current.status === "error") {
        return current;
      }

      return {
        ...current,
        status: "error",
      };
    });
  }, [garmentValidation.error]);

  useEffect(() => {
    setFormState((current) => {
      if (submission.submitting) {
        if (current.status === "submitting") {
          return current;
        }
        return { ...current, status: "submitting" };
      }

      if (garmentValidation.validating) {
        if (current.status === "validating") {
          return current;
        }
        return { ...current, status: "validating" };
      }

      if (current.status === "submitting" || current.status === "validating") {
        return { ...current, status: current.error ? "error" : "idle" };
      }

      return current;
    });
  }, [garmentValidation.validating, submission.submitting]);

  useEffect(() => {
    const previousUrl = previousPreviewUrl.current;
    const nextUrl = formState.garment?.previewUrl ?? null;

    if (previousUrl && previousUrl !== nextUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    previousPreviewUrl.current = nextUrl;

    return () => {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [formState.garment]);

  const handleGarmentChange = useCallback(
    async (files: FileList | null) => {
      submission.resetError();
      garmentValidation.resetError();

      const validated = await garmentValidation.validate(files);

      setFormState((current) => ({
        ...current,
        garment: validated,
        error: null,
        status: validated ? (current.status === "success" ? "success" : "idle") : "error",
      }));
    },
    [garmentValidation, submission]
  );

  const handleGarmentClear = useCallback(() => {
    garmentValidation.resetError();
    submission.resetError();
    setFormState((current) => ({
      ...current,
      garment: null,
      error: null,
      status: current.status === "success" ? "success" : "idle",
    }));
  }, [garmentValidation, submission]);

  const handleConsentToggle = useCallback(
    (checked: boolean) => {
      submission.resetError();
      setFormState((current) => ({
        ...current,
        consent: {
          ...current.consent,
          checkboxChecked: checked,
        },
        error: null,
        status: checked ? (current.status === "success" ? "success" : "idle") : "error",
      }));
    },
    [submission]
  );

  const handleRetentionChange = useCallback((value: number) => {
    if (!RETENTION_ALLOWED_VALUES.includes(value as (typeof RETENTION_ALLOWED_VALUES)[number])) {
      return;
    }

    setFormState((current) => ({
      ...current,
      retainForHours: value,
      error: null,
      status: current.status === "success" ? "success" : current.status === "error" ? "idle" : current.status,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submission.resetError();
      garmentValidation.resetError();
      setFormState((current) => ({
        ...current,
        error: null,
        status: current.status === "success" ? "success" : "idle",
      }));

      const { garment, consent, quota, retainForHours } = formState;

      if (!garment) {
        setFormState((current) => ({
          ...current,
          status: "error",
          error: createFormError("garment_missing", "Dodaj zdjęcie ubrania przed uruchomieniem generacji.", "garment"),
        }));
        return;
      }

      if (!consent.checkboxChecked) {
        setFormState((current) => ({
          ...current,
          status: "error",
          error: createFormError(
            "consent_unchecked",
            "Potwierdź zgodę na przetwarzanie wizerunku, aby kontynuować.",
            "consent"
          ),
        }));
        return;
      }

      if (quota.hardLimitReached || quota.remaining <= 0) {
        setFormState((current) => ({
          ...current,
          status: "error",
          error: createFormError(
            "quota_exhausted",
            "Limit darmowych generacji został wykorzystany. Odczekaj do odnowienia puli.",
            "form"
          ),
        }));
        return;
      }

      const outcome = await submission.submitGeneration({
        garment,
        consent,
        retainForHours,
      });

      if (!outcome) {
        setFormState((current) => ({
          ...current,
          status: "error",
        }));
        return;
      }

      const updatedProfile = outcome.refreshedProfile ?? submission.profile;

      setFormState((current) => ({
        ...current,
        garment: null,
        retainForHours: current.retainForHours,
        quota: mapQuotaViewModel(updatedProfile),
        consent: {
          ...current.consent,
          acceptedVersion: outcome.consentReceipt?.acceptedVersion ?? updatedProfile.consent.acceptedVersion,
          acceptedAt: outcome.consentReceipt?.acceptedAt ?? updatedProfile.consent.acceptedAt,
          isCompliant: true,
          checkboxChecked: true,
        },
        status: "success",
        error: null,
      }));

      const targetPath = `${basePath}/${outcome.generation.id}`;
      if (onSuccess) {
        onSuccess(outcome.generation.id);
      } else if (typeof window !== "undefined") {
        window.location.assign(targetPath);
      }
    },
    [basePath, formState, garmentValidation, onSuccess, submission]
  );

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit} data-testid="generation-form">
      <QuotaIndicator quota={formState.quota} />
      <GarmentUploadField
        value={formState.garment}
        error={garmentValidation.error}
        validating={garmentValidation.validating}
        constraints={constraints}
        onFileSelect={handleGarmentChange}
        onClear={handleGarmentClear}
      />
      <ConsentReaffirmation
        state={formState.consent}
        onToggle={handleConsentToggle}
        policyUrl={consentPolicyUrl}
        disabled={submission.submitting}
      />
      <RetentionSelector
        value={formState.retainForHours}
        options={RETENTION_OPTIONS}
        disabled={submission.submitting}
        onChange={handleRetentionChange}
      />
      <FormAlerts
        status={formState.status}
        formError={submission.error ?? formState.error}
        garmentError={garmentValidation.error}
        quotaLocked={quotaLocked}
        consentOutdated={consentRequiresUpdate && !formState.consent.checkboxChecked}
      />
      <div className="flex justify-end">
        <GeneratePrimaryButton
          disabled={submitDisabled}
          loading={submission.submitting}
          remainingQuota={formState.quota.remaining}
        />
      </div>
    </form>
  );
}

function createInitialFormState(profile: ProfileResponseDto, retention: number): GenerationFormState {
  const consent = buildConsentState(profile);
  const quota = mapQuotaViewModel(profile);

  return {
    garment: null,
    consent,
    retainForHours: retention,
    quota,
    status: "idle",
    error: null,
  };
}

function buildConsentState(profile: ProfileResponseDto): ConsentFormState {
  return {
    currentVersion: profile.consent.currentVersion,
    acceptedVersion: profile.consent.acceptedVersion,
    acceptedAt: profile.consent.acceptedAt,
    isCompliant: profile.consent.isCompliant,
    checkboxChecked: false,
  };
}

function mapQuotaViewModel(profile: ProfileResponseDto): QuotaViewModel {
  const { total, remaining, renewsAt } = profile.quota.free;
  const hardLimitReached = remaining <= 0;

  return {
    total,
    remaining,
    renewsAt,
    hardLimitReached,
  };
}

function hasQuotaChanged(previous: QuotaViewModel, next: QuotaViewModel): boolean {
  return (
    previous.remaining !== next.remaining ||
    previous.total !== next.total ||
    previous.renewsAt !== next.renewsAt ||
    previous.hardLimitReached !== next.hardLimitReached
  );
}

function hasConsentChanged(consent: ConsentFormState, snapshot: ProfileResponseDto["consent"]): boolean {
  return (
    consent.currentVersion !== snapshot.currentVersion ||
    consent.acceptedVersion !== snapshot.acceptedVersion ||
    consent.acceptedAt !== snapshot.acceptedAt ||
    consent.isCompliant !== snapshot.isCompliant
  );
}

function normalizeRetentionValue(retention?: number): number {
  if (!retention || !RETENTION_ALLOWED_VALUES.includes(retention as (typeof RETENTION_ALLOWED_VALUES)[number])) {
    return DEFAULT_RETENTION;
  }

  return retention;
}

function normalizeDetailsBasePath(candidate?: string): string {
  if (!candidate) {
    return "/generations";
  }

  if (candidate === "/") {
    return "";
  }

  return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}

function createFormError(code: string, message: string, field: GenerationErrorState["field"]): GenerationErrorState {
  return {
    code,
    message,
    field,
  };
}

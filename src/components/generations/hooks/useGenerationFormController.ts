import { useCallback, useMemo, useReducer } from "react";

import type { ConsentUpsertResponseDto, ProfileResponseDto } from "@/types.ts";

import type {
  ConsentFormState,
  GarmentFileState,
  GenerationErrorState,
  GenerationFormState,
  QuotaViewModel,
  RetentionOption,
} from "../types.ts";

interface UseGenerationFormControllerOptions {
  profile: ProfileResponseDto;
  retention: number;
}

interface SubmissionSuccessPayload {
  profile: ProfileResponseDto;
  consentReceipt: ConsentUpsertResponseDto | null;
}

type GenerationFormAction =
  | { type: "reset"; payload: { profile: ProfileResponseDto; retention: number } }
  | { type: "set_garment"; payload: GarmentFileState | null }
  | { type: "set_garment_null" }
  | { type: "set_consent_checkbox"; payload: boolean }
  | { type: "set_retention"; payload: number }
  | { type: "set_status"; payload: GenerationFormState["status"] }
  | { type: "set_error"; payload: GenerationErrorState | null }
  | { type: "sync_profile"; payload: ProfileResponseDto }
  | { type: "apply_success"; payload: SubmissionSuccessPayload };

function generationFormReducer(state: GenerationFormState, action: GenerationFormAction): GenerationFormState {
  switch (action.type) {
    case "reset":
      return createInitialFormState(action.payload.profile, action.payload.retention);
    case "set_garment":
      if (state.garment === action.payload) {
        return state;
      }
      return {
        ...state,
        garment: action.payload,
      };
    case "set_garment_null":
      if (!state.garment) {
        return state;
      }
      return {
        ...state,
        garment: null,
      };
    case "set_consent_checkbox":
      if (state.consent.checkboxChecked === action.payload) {
        return state;
      }
      return {
        ...state,
        consent: {
          ...state.consent,
          checkboxChecked: action.payload,
        },
      };
    case "set_retention":
      if (state.retainForHours === action.payload) {
        return state;
      }
      return {
        ...state,
        retainForHours: action.payload,
      };
    case "set_status":
      if (state.status === action.payload) {
        return state;
      }
      return {
        ...state,
        status: action.payload,
      };
    case "set_error":
      if (state.error === action.payload) {
        return state;
      }
      return {
        ...state,
        error: action.payload,
      };
    case "sync_profile": {
      const nextQuota = mapQuotaViewModel(action.payload);
      const quotaChanged = hasQuotaChanged(state.quota, nextQuota);
      const consentChanged = hasConsentChanged(state.consent, action.payload.consent);

      if (!quotaChanged && !consentChanged) {
        return state;
      }

      return {
        ...state,
        quota: quotaChanged ? nextQuota : state.quota,
        consent: consentChanged
          ? syncConsentState(state.consent, action.payload.consent)
          : state.consent,
      };
    }
    case "apply_success": {
      const quota = mapQuotaViewModel(action.payload.profile);
      const consentSnapshot = action.payload.profile.consent;
      const acceptedVersion = action.payload.consentReceipt?.acceptedVersion ?? consentSnapshot.acceptedVersion;
      const acceptedAt = action.payload.consentReceipt?.acceptedAt ?? consentSnapshot.acceptedAt;

      return {
        ...state,
        garment: null,
        quota,
        consent: {
          ...state.consent,
          acceptedVersion,
          acceptedAt,
          isCompliant: true,
          checkboxChecked: true,
          currentVersion: consentSnapshot.currentVersion,
        },
        status: "success",
        error: null,
      };
    }
    default:
      return state;
  }
}

export function useGenerationFormController(options: UseGenerationFormControllerOptions) {
  const { profile, retention } = options;
  const [state, dispatch] = useReducer(
    generationFormReducer,
    undefined,
    () => createInitialFormState(profile, retention),
  );

  const setGarment = useCallback((value: GarmentFileState | null) => {
    if (value) {
      dispatch({ type: "set_garment", payload: value });
      return;
    }
    dispatch({ type: "set_garment_null" });
  }, []);

  const setConsentChecked = useCallback((checked: boolean) => {
    dispatch({ type: "set_consent_checkbox", payload: checked });
  }, []);

  const setRetentionValue = useCallback((value: number) => {
    dispatch({ type: "set_retention", payload: value });
  }, []);

  const setStatus = useCallback((status: GenerationFormState["status"]) => {
    dispatch({ type: "set_status", payload: status });
  }, []);

  const setError = useCallback((nextError: GenerationErrorState | null) => {
    dispatch({ type: "set_error", payload: nextError });
  }, []);

  const syncProfile = useCallback((nextProfile: ProfileResponseDto) => {
    dispatch({ type: "sync_profile", payload: nextProfile });
  }, []);

  const resetState = useCallback(
    (nextProfile: ProfileResponseDto, nextRetention: number) => {
      dispatch({
        type: "reset",
        payload: {
          profile: nextProfile,
          retention: nextRetention,
        },
      });
    },
    [],
  );

  const applySubmissionSuccess = useCallback(
    (payload: SubmissionSuccessPayload) => {
      dispatch({ type: "apply_success", payload });
    },
    [],
  );

  const actions = useMemo(
    () => ({
      setGarment,
      setConsentChecked,
      setRetentionValue,
      setStatus,
      setError,
      syncProfile,
      resetState,
      applySubmissionSuccess,
    }),
    [setConsentChecked, setError, setGarment, setRetentionValue, setStatus, syncProfile, resetState, applySubmissionSuccess],
  );

  return {
    state,
    actions,
  };
}

export function createInitialFormState(profile: ProfileResponseDto, retention: number): GenerationFormState {
  return {
    garment: null,
    consent: buildConsentState(profile),
    retainForHours: retention,
    quota: mapQuotaViewModel(profile),
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

function syncConsentState(previous: ConsentFormState, snapshot: ProfileResponseDto["consent"]): ConsentFormState {
  return {
    ...previous,
    currentVersion: snapshot.currentVersion,
    acceptedVersion: snapshot.acceptedVersion,
    acceptedAt: snapshot.acceptedAt,
    isCompliant: snapshot.isCompliant,
    checkboxChecked: snapshot.isCompliant ? previous.checkboxChecked : false,
  };
}

export function mapQuotaViewModel(profile: ProfileResponseDto): QuotaViewModel {
  const { total, remaining, renewsAt } = profile.quota.free;
  return {
    total,
    remaining,
    renewsAt,
    hardLimitReached: remaining <= 0,
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

export function normalizeRetentionValue(retention?: number): number {
  if (!retention || !RETENTION_ALLOWED_VALUES.includes(retention as (typeof RETENTION_ALLOWED_VALUES)[number])) {
    return DEFAULT_RETENTION;
  }
  return retention;
}

export function normalizeDetailsBasePath(candidate?: string): string {
  if (!candidate) {
    return "/generations";
  }
  if (candidate === "/") {
    return "";
  }
  return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}

export function createFormError(
  code: string,
  message: string,
  field: GenerationErrorState["field"],
): GenerationErrorState {
  return {
    code,
    message,
    field,
  };
}

export const RETENTION_ALLOWED_VALUES = [24, 48, 72] as const;
export const DEFAULT_RETENTION = 48;
export const RETENTION_OPTIONS: RetentionOption[] = [
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
] as const satisfies ReadonlyArray<{
  value: number;
  label: string;
  description: string;
}>;

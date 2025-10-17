import { useCallback, useEffect, useState } from "react";

import type {
  ConsentUpsertResponseDto,
  GenerationQueuedResponseDto,
  ProfileResponseDto,
} from "@/types.ts";
import { requireAccessToken } from "@/components/onboarding/persona/session.ts";

import type {
  ConsentFormState,
  GenerationErrorState,
  GenerationSubmissionResult,
  SubmitGenerationOutcome,
  SubmitGenerationParams,
  UseGenerationSubmissionOptions,
  UseGenerationSubmissionResult,
} from "../types.ts";

const CONSENT_ENDPOINT = "/api/profile/consent";
const GENERATIONS_ENDPOINT = "/api/vton/generations";
const PROFILE_ENDPOINT = "/api/profile";

export function useGenerationSubmission({ profile }: UseGenerationSubmissionOptions): UseGenerationSubmissionResult {
  const [currentProfile, setCurrentProfile] = useState<ProfileResponseDto>(profile);
  const [submitting, setSubmitting] = useState(false);
  const [updatingConsent, setUpdatingConsent] = useState(false);
  const [error, setError] = useState<GenerationErrorState | null>(null);

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const refreshProfile = useCallback(async (): Promise<ProfileResponseDto | null> => {
    try {
      const accessToken = await requireAccessToken();
      const response = await fetch(PROFILE_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        console.warn("[useGenerationSubmission] Failed to refresh profile.", { status: response.status });
        return null;
      }

      const payload = await safeJson<ProfileResponseDto>(response);
      if (!payload) {
        console.warn("[useGenerationSubmission] Profile refresh returned empty payload.");
        return null;
      }

      setCurrentProfile(payload);
      return payload;
    } catch (unknownError) {
      console.error("[useGenerationSubmission] Refresh profile request failed.", unknownError);
      return null;
    }
  }, []);

  const updateConsentIfRequired = useCallback(
    async (consent: ConsentFormState): Promise<ConsentUpsertResponseDto | null> => {
      if (consent.isCompliant && consent.acceptedVersion === consent.currentVersion) {
        return null;
      }

      if (!consent.checkboxChecked) {
        const consentError = createErrorState(
          "consent_unchecked",
          "Aby kontynuować, zaznacz zgodę na przetwarzanie wizerunku.",
          "consent"
        );
        setError(consentError);
        return null;
      }

      setUpdatingConsent(true);
      setError(null);

      try {
        const accessToken = await requireAccessToken();
        const response = await fetch(CONSENT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
          body: JSON.stringify({
            version: consent.currentVersion,
            accepted: true,
          }),
        });

        if (!response.ok) {
          const consentError = await mapConsentError(response);
          setError(consentError);
          if (response.status === 409 || response.status === 422) {
            void refreshProfile();
          }
          return null;
        }

        const receipt = await safeJson<ConsentUpsertResponseDto>(response);
        if (!receipt) {
          const consentError = createErrorState(
            "consent_invalid_response",
            "Serwer nie zwrócił potwierdzenia zaktualizowanej zgody.",
            "consent"
          );
          setError(consentError);
          return null;
        }

        setCurrentProfile((previous) => ({
          ...previous,
          consent: {
            currentVersion: consent.currentVersion,
            acceptedVersion: receipt.acceptedVersion,
            acceptedAt: receipt.acceptedAt,
            isCompliant: receipt.acceptedVersion === consent.currentVersion,
          },
        }));

        return receipt;
      } catch (unknownError) {
        const consentError = createUnknownError(
          "consent_network_error",
          "Nie udało się zaktualizować zgody. Sprawdź połączenie z internetem i spróbuj ponownie.",
          "consent",
          unknownError
        );
        setError(consentError);
        return null;
      } finally {
        setUpdatingConsent(false);
      }
    },
    [refreshProfile]
  );

  const submitGeneration = useCallback(
    async (params: SubmitGenerationParams): Promise<SubmitGenerationOutcome | null> => {
      if (!params.garment?.file) {
        const garmentError = createErrorState(
          "garment_missing",
          "Wybierz zdjęcie ubrania przed wysłaniem formularza.",
          "garment"
        );
        setError(garmentError);
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        let consentReceipt: ConsentUpsertResponseDto | null = null;
        const consentOutdated =
          !params.consent.isCompliant || params.consent.acceptedVersion !== params.consent.currentVersion;
        if (consentOutdated) {
          consentReceipt = await updateConsentIfRequired(params.consent);
          if (!consentReceipt) {
            return null;
          }
        }

        const accessToken = await requireAccessToken();
        const formData = new FormData();
        formData.append("garment", params.garment.file, params.garment.file.name);
        formData.append("consentVersion", params.consent.currentVersion);
        formData.append("retainForHours", String(params.retainForHours));

        const response = await fetch(GENERATIONS_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
          body: formData,
        });

        if (response.status === 202) {
          const payload = await safeJson<GenerationQueuedResponseDto>(response);
          if (!payload) {
            const payloadError = createErrorState(
              "generation_missing_payload",
              "Serwer nie zwrócił informacji o uruchomionej generacji.",
              "form"
            );
            setError(payloadError);
            return null;
          }

        let updatedProfile: ProfileResponseDto | null = null;
        setCurrentProfile((previous) => {
          const total = previous.quota.free.total;
          const remaining = payload.quota.remainingFree;
          const used = Math.max(total - remaining, 0);
          updatedProfile = {
            ...previous,
            quota: {
              ...previous.quota,
              free: {
                ...previous.quota.free,
                remaining,
                used,
              },
            },
          };
          return updatedProfile;
        });

        const submissionResult: GenerationSubmissionResult = {
          id: payload.id,
          quota: {
            remainingFree: payload.quota.remainingFree,
            },
            etaSeconds: payload.etaSeconds,
          };

        return {
          generation: submissionResult,
          payload,
          consentReceipt,
          refreshedProfile: updatedProfile,
        };
        }

        const generationError = await mapGenerationError(response);
        if (shouldRefetchProfile(response.status)) {
          void refreshProfile();
        }

        setError(generationError);
        return null;
      } catch (unknownError) {
        const generationError = createUnknownError(
          "generation_network_error",
          "Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.",
          "form",
          unknownError
        );
        setError(generationError);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [refreshProfile, updateConsentIfRequired]
  );

  return {
    profile: currentProfile,
    submitting,
    updatingConsent,
    error,
    submitGeneration,
    updateConsentIfRequired,
    refreshProfile,
    resetError,
  };
}

async function mapConsentError(response: Response): Promise<GenerationErrorState> {
  const serverMessage = await extractErrorMessage(response);

  switch (response.status) {
    case 401:
      return createErrorState(
        "consent_unauthorized",
        serverMessage ?? "Sesja wygasła. Zaloguj się ponownie, aby potwierdzić zgodę.",
        "form"
      );
    case 403:
      return createErrorState(
        "consent_forbidden",
        serverMessage ?? "Brak uprawnień do zapisania zgody.",
        "form"
      );
    case 409:
      return createErrorState(
        "consent_conflict",
        serverMessage ?? "Twoja zgoda została już zaktualizowana. Odśwież widok i spróbuj ponownie.",
        "consent"
      );
    case 422:
    case 400:
      return createErrorState(
        "consent_invalid",
        serverMessage ?? "Serwer odrzucił aktualizację zgody. Odśwież stronę i spróbuj ponownie.",
        "consent"
      );
    default:
      return createErrorState(
        "consent_server_error",
        serverMessage ?? "Nie udało się zapisać zgody. Spróbuj ponownie później.",
        "consent"
      );
  }
}

async function mapGenerationError(response: Response): Promise<GenerationErrorState> {
  const serverMessage = await extractErrorMessage(response);
  const retryAfter = parseRetryAfter(response.headers.get("retry-after"));

  switch (response.status) {
    case 400:
    case 422:
      return createErrorState(
        "invalid_payload",
        serverMessage ?? "Serwer odrzucił dane formularza. Sprawdź wprowadzone informacje i spróbuj ponownie.",
        "form",
        retryAfter
      );
    case 401:
      return createErrorState(
        "unauthorized",
        serverMessage ?? "Sesja wygasła. Zaloguj się ponownie, aby kontynuować.",
        "form",
        retryAfter
      );
    case 403:
      return createErrorState(
        "forbidden",
        serverMessage ?? "Brak uprawnień do uruchomienia generacji.",
        "form",
        retryAfter
      );
    case 404:
      return createErrorState(
        "persona_missing",
        serverMessage ?? "Nie znaleziono persony użytkownika. Przejdź do onboardingu i dodaj zdjęcie referencyjne.",
        "form",
        retryAfter
      );
    case 409:
      return createErrorState(
        "conflict",
        serverMessage ?? "Nie można uruchomić generacji w tym momencie. Odśwież dane i spróbuj ponownie.",
        "form",
        retryAfter
      );
    case 429:
      return createErrorState(
        "quota_exhausted",
        serverMessage ?? "Wykorzystano limit generacji. Odczekaj chwilę lub zwiększ pakiet.",
        "form",
        retryAfter
      );
    default:
      return createErrorState(
        "server_error",
        serverMessage ?? "Wystąpił błąd serwera podczas uruchamiania generacji. Spróbuj ponownie później.",
        "form",
        retryAfter
      );
  }
}

function shouldRefetchProfile(status: number): boolean {
  return status === 400 || status === 409 || status === 422;
}

async function extractErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const cloned = response.clone();
    const payload = await cloned.json();
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string" && payload.message.trim().length > 0) {
        return payload.message;
      }

      if (typeof payload.error === "string" && payload.error.trim().length > 0) {
        return payload.error;
      }
    }
  } catch {
    // ignore JSON parse failures
  }

  return undefined;
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const numeric = Number.parseInt(headerValue, 10);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }

  return undefined;
}

function createErrorState(
  code: string,
  message: string,
  field: GenerationErrorState["field"],
  retryAfterSeconds?: number
): GenerationErrorState {
  return {
    code,
    message,
    field,
    retryAfterSeconds,
  };
}

function createUnknownError(
  code: string,
  message: string,
  field: GenerationErrorState["field"],
  cause: unknown
): GenerationErrorState {
  if (import.meta.env.DEV) {
    console.error("[useGenerationSubmission] Operation failed.", cause);
  }

  return createErrorState(code, message, field);
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    console.warn("[useGenerationSubmission] Failed to parse JSON response.", {
      status: response.status,
      cause: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

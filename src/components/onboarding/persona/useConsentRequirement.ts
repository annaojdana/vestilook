import { useCallback, useEffect, useMemo, useState } from "react";

import type { ConsentReceipt, ConsentRequirement } from "@/types.ts";
import { isAccessTokenError, requireAccessToken } from "./session.ts";

export interface ConsentRequestError {
  code: "unauthorized" | "forbidden" | "conflict" | "network" | "server" | "unknown";
  message: string;
  status?: number;
  details?: Record<string, unknown>;
}

export interface UseConsentRequirementOptions {
  onResolved?: (receipt: ConsentReceipt) => void;
}

export interface UseConsentRequirementResult {
  consent: ConsentRequirement;
  loading: boolean;
  error: ConsentRequestError | null;
  requestConsent: () => Promise<ConsentReceipt | null>;
  resetError: () => void;
}

const CONSENT_ENDPOINT = "/api/profile/consent";

export function useConsentRequirement(
  initialConsent: ConsentRequirement,
  { onResolved }: UseConsentRequirementOptions = {}
): UseConsentRequirementResult {
  const [consent, setConsent] = useState<ConsentRequirement>(initialConsent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ConsentRequestError | null>(null);

  const requestConsent = useCallback(async (): Promise<ConsentReceipt | null> => {
    if (loading) {
      return null;
    }

    const requiredVersion = consent.requiredVersion;
    if (!requiredVersion) {
      setError({
        code: "server",
        message: "Brakuje informacji o wymaganej wersji zgody.",
      });
      return null;
    }

    setLoading(true);
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
          version: requiredVersion,
          accepted: true,
        }),
      });

      if (response.status === 401) {
        throw <ConsentRequestError>{
          code: "unauthorized",
          status: response.status,
          message: "Sesja wygasła. Zaloguj się ponownie.",
        };
      }

      if (response.status === 403) {
        throw <ConsentRequestError>{
          code: "forbidden",
          status: response.status,
          message: "Brak uprawnień do zapisania zgody.",
        };
      }

      if (response.status === 409) {
        throw <ConsentRequestError>{
          code: "conflict",
          status: response.status,
          message: "Twoja zgoda została już zaktualizowana. Odśwież widok.",
        };
      }

      if (!response.ok) {
        throw <ConsentRequestError>{
          code: "server",
          status: response.status,
          message: "Serwer odrzucił zapis zgody. Spróbuj ponownie później.",
        };
      }

      const receipt = (await parseJson<ConsentReceipt>(response)) ?? null;
      if (!receipt) {
        throw <ConsentRequestError>{
          code: "server",
          status: response.status,
          message: "Serwer nie zwrócił potwierdzenia zapisu zgody.",
        };
      }

      setConsent((current) => ({
        requiredVersion: current.requiredVersion,
        acceptedVersion: receipt.acceptedVersion ?? current.acceptedVersion ?? null,
        acceptedAt: receipt.acceptedAt ?? current.acceptedAt ?? null,
        isCompliant: receipt.acceptedVersion === current.requiredVersion,
      }));

      onResolved?.(receipt);
      return receipt;
    } catch (unknownError) {
      const consentError = mapError(unknownError);
      setError(consentError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [consent.requiredVersion, loading, onResolved]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    setConsent(initialConsent);
  }, [initialConsent]);

  return useMemo(
    () => ({
      consent,
      loading,
      error,
      requestConsent,
      resetError,
    }),
    [consent, error, loading, requestConsent, resetError]
  );
}

async function parseJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw <ConsentRequestError>{
      code: "server",
      status: response.status,
      message: "Nie udało się odczytać odpowiedzi serwera.",
      details: { cause: error instanceof Error ? error.message : String(error) },
    };
  }
}

function mapError(error: unknown): ConsentRequestError {
  if (!error) {
    return {
      code: "unknown",
      message: "Wystąpił nieoczekiwany błąd podczas zapisu zgody.",
    };
  }

  if (isConsentRequestError(error)) {
    return error;
  }

  if (isAccessTokenError(error)) {
    return {
      code: "unauthorized",
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "network",
      message: "Żądanie zostało przerwane.",
    };
  }

  if (error instanceof TypeError) {
    return {
      code: "network",
      message: "Nie udało się połączyć z serwerem. Sprawdź swoje połączenie z internetem.",
    };
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message,
    };
  }

  return {
    code: "unknown",
    message: "Wystąpił nieznany błąd. Spróbuj ponownie.",
  };
}

function isConsentRequestError(error: unknown): error is ConsentRequestError {
  return Boolean(error && typeof error === "object" && "code" in error && "message" in error);
}

import { supabaseClient } from "@/db/supabase.client.ts";
import type { ConsentStatusResponseDto, ConsentUpsertCommand, ConsentUpsertResponseDto } from "@/types.ts";

import { ConsentApiError, type ConsentSubmissionResult, type ConsentViewModel } from "./consent-types.ts";

const CONSENT_ENDPOINT = "/api/profile/consent";

type PolicySource = ConsentViewModel["metadata"]["source"];

interface ConsentStatusApiResponse extends ConsentStatusResponseDto {
  policyContent?: string;
  policyUrl?: string;
  metadata?: {
    updatedAt?: string;
    source?: PolicySource;
  };
}

interface FetchConsentStatusOptions {
  signal?: AbortSignal;
}

interface SubmitConsentOptions {
  signal?: AbortSignal;
}

export async function fetchConsentStatus(options: FetchConsentStatusOptions = {}): Promise<ConsentViewModel> {
  const accessToken = await requireAccessToken();

  let response: Response;
  try {
    response = await fetch(CONSENT_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (response.status === 204) {
    throw new ConsentApiError("Brak treści zgody do wyświetlenia.", {
      code: "server_error",
      status: 204,
    });
  }

  if (!response.ok) {
    throw buildApiErrorFromResponse(response);
  }

  const payload = (await parseJson<ConsentStatusApiResponse>(response)) ?? undefined;
  if (!payload) {
    throw new ConsentApiError("Serwer zwrócił pustą odpowiedź.", {
      code: "server_error",
      status: response.status,
    });
  }

  return mapToViewModel(payload);
}

export async function submitConsentAcceptance(
  command: ConsentUpsertCommand,
  options: SubmitConsentOptions = {}
): Promise<ConsentSubmissionResult> {
  const accessToken = await requireAccessToken();

  let response: Response;
  try {
    response = await fetch(CONSENT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify(command),
      signal: options.signal,
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw buildApiErrorFromResponse(response);
  }

  const payload = await parseJson<ConsentUpsertResponseDto>(response);
  if (!payload?.acceptedVersion || !payload.acceptedAt) {
    throw new ConsentApiError("Odpowiedź serwera nie zawiera potwierdzenia zgody.", {
      code: "server_error",
      status: response.status,
      details: { body: payload ?? null },
    });
  }

  const status = response.status === 201 ? "created" : "updated";

  return {
    acceptedVersion: payload.acceptedVersion,
    acceptedAt: payload.acceptedAt,
    status,
  };
}

async function requireAccessToken(): Promise<string> {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw new ConsentApiError("Nie udało się pobrać danych sesji użytkownika.", {
      code: "unauthorized",
      status: 401,
      details: { cause: error.message },
    });
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new ConsentApiError("Brak aktywnej sesji użytkownika.", {
      code: "unauthorized",
      status: 401,
    });
  }

  return accessToken;
}

function handleNetworkError(error: unknown): never {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw error;
  }

  throw new ConsentApiError("Wystąpił problem z połączeniem sieciowym.", {
    code: "network",
    details: {
      cause: error instanceof Error ? error.message : String(error),
    },
  });
}

async function parseJson<T>(response: Response): Promise<T | undefined> {
  const contentLength = response.headers.get("content-length");
  const hasBody =
    (contentLength !== null && Number.parseInt(contentLength, 10) > 0) ||
    response.headers.get("content-type")?.includes("application/json");

  if (!hasBody) {
    return undefined;
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ConsentApiError("Nie udało się zinterpretować odpowiedzi serwera.", {
      code: "server_error",
      status: response.status,
      details: { cause: error instanceof Error ? error.message : String(error) },
    });
  }
}

function mapToViewModel(payload: ConsentStatusApiResponse): ConsentViewModel {
  const { requiredVersion, acceptedVersion, acceptedAt, isCompliant } = payload;

  if (!requiredVersion) {
    throw new ConsentApiError("Serwer nie zwrócił wymaganej wersji zgody.", {
      code: "server_error",
    });
  }

  const policyContent = typeof payload.policyContent === "string" ? payload.policyContent : "";
  const policyUrl = typeof payload.policyUrl === "string" && payload.policyUrl.length > 0 ? payload.policyUrl : "#";
  const metadata = normalizeMetadata(payload.metadata);

  return {
    requiredVersion,
    acceptedVersion,
    acceptedAt,
    isCompliant: Boolean(isCompliant),
    policyContent,
    policyUrl,
    metadata,
  };
}

function normalizeMetadata(metadata: ConsentStatusApiResponse["metadata"]): ConsentViewModel["metadata"] {
  return {
    updatedAt: metadata?.updatedAt,
    source: metadata?.source === "gcp" ? "gcp" : "internal",
  };
}

function buildApiErrorFromResponse(response: Response): ConsentApiError {
  const status = response.status;

  if (status === 401) {
    return new ConsentApiError("Sesja wygasła. Zaloguj się ponownie.", {
      code: "unauthorized",
      status,
    });
  }

  if (status === 400) {
    return new ConsentApiError("Serwer odrzucił przesłane dane.", {
      code: "bad_request",
      status,
    });
  }

  if (status === 409) {
    return new ConsentApiError("Pojawiła się nowa wersja zgody. Odśwież dane.", {
      code: "conflict",
      status,
    });
  }

  return new ConsentApiError("Wystąpił nieoczekiwany błąd serwera.", {
    code: "server_error",
    status,
  });
}

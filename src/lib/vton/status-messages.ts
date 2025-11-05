import type { GenerationStatus } from "@/types.ts";

export type FailureActionIntent = "retry" | "contact-support" | "view-logs" | "reupload-garment";

export interface FailureContext {
  code: string;
  title: string;
  description: string;
  hint?: string;
  logExcerpt?: string;
  actions: FailureActionIntent[];
  supportUrl?: string;
}

export interface StatusMessage {
  label: string;
  description: string;
}

const STATUS_MESSAGES: Record<GenerationStatus | "unknown", StatusMessage> = {
  queued: {
    label: "W kolejce",
    description: "Zadanie oczekuje na uruchomienie w usłudze Vertex AI.",
  },
  processing: {
    label: "Przetwarzanie",
    description: "Vertex AI generuje wizualizację na bazie przesłanych assetów.",
  },
  succeeded: {
    label: "Gotowe",
    description: "Stylizacja jest gotowa do przejrzenia i pobrania.",
  },
  failed: {
    label: "Niepowodzenie",
    description: "Vertex AI nie ukończył przetwarzania generacji.",
  },
  expired: {
    label: "Wygasło",
    description: "Generacja wygasła i nie jest już dostępna do pobrania.",
  },
  unknown: {
    label: "Nieznany status",
    description: "Nie udało się ustalić bieżącego statusu generacji.",
  },
};

const FAILURE_CONTEXTS: Record<string, FailureContext> = {
  quota_exhausted: {
    code: "quota_exhausted",
    title: "Limit generacji został wykorzystany",
    description:
      "Wykorzystałeś cały przydział generacji w obecnym okresie rozliczeniowym. Odnowienie limitu nastąpi automatycznie wraz z resetem kwoty.",
    hint: "Możesz poczekać na odnowienie puli lub rozważyć zwiększenie planu.",
    actions: ["contact-support", "retry"],
  },
  persona_missing: {
    code: "persona_missing",
    title: "Brakuje zdjęcia sylwetki",
    description:
      "Aby wygenerować stylizację, potrzebujemy aktualnego zdjęcia sylwetki. Wygląda na to, że nie zostało ono zapisane lub utraciło ważność.",
    hint: "Prześlij ponownie zdjęcie sylwetki w sekcji Profil.",
    actions: ["reupload-garment", "retry"],
  },
  invalid_request: {
    code: "invalid_request",
    title: "Błąd walidacji zgłoszenia",
    description:
      "Vertex AI odrzucił zadanie z powodu niepoprawnych danych wejściowych. Najczęściej dotyczy to błędnego formatu pliku lub rozmiaru.",
    hint: "Upewnij się, że plik spełnia wymagane parametry i spróbuj ponownie.",
    actions: ["reupload-garment", "retry"],
  },
  missing_result: {
    code: "missing_result",
    title: "Wynik nie został zapisany",
    description:
      "Otrzymaliśmy sygnał zakończenia zadania, ale plik wynikowy nie jest dostępny. To może oznaczać błąd po stronie magazynu.",
    hint: "Spróbuj ponownie uruchomić generację. Jeśli problem się powtórzy, skontaktuj się z nami.",
    actions: ["retry", "contact-support"],
  },
  vertex_failure: {
    code: "vertex_failure",
    title: "Błąd po stronie Vertex AI",
    description:
      "Vertex AI zwrócił błąd w trakcie przetwarzania zadania. Może to wynikać z chwilowej niedostępności usługi.",
    hint: "Odczekaj chwilę i spróbuj ponownie. Jeśli problem będzie się powtarzał, zgłoś go do zespołu wsparcia.",
    actions: ["retry", "contact-support"],
  },
};

const DEFAULT_FAILURE_CONTEXT: FailureContext = {
  code: "unknown_failure",
  title: "Nieoczekiwany błąd generacji",
  description:
    "Podczas generowania stylizacji wystąpił nieznany błąd. Dalsze szczegóły nie są dostępne w logach.",
  hint: "Spróbuj ponownie uruchomić generację lub zgłoś problem do zespołu wsparcia.",
  actions: ["retry", "contact-support"],
};

export function getStatusMessage(status: GenerationStatus | null | undefined): StatusMessage {
  const key = status ?? "unknown";
  return STATUS_MESSAGES[key] ?? STATUS_MESSAGES.unknown;
}

export function getFailureContext(code: string | null | undefined): FailureContext | null {
  if (!code) {
    return null;
  }

  return FAILURE_CONTEXTS[code] ?? {
    ...DEFAULT_FAILURE_CONTEXT,
    code,
  };
}


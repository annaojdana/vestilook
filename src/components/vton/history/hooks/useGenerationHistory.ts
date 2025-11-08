import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  GenerationHistoryFilters,
  GenerationHistoryItemViewModel,
  GenerationListResponseDto,
  GenerationStatus,
  GenerationSummaryDto,
} from "../../../types";

interface UseGenerationHistoryProps {
  filters: GenerationHistoryFilters;
  cursor?: string | null;
  sessionToken?: string | null;
}

interface UseGenerationHistoryResult {
  items: GenerationHistoryItemViewModel[];
  nextCursor: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const STATUS_LABELS: Record<GenerationStatus, string> = {
  queued: "Oczekuje w kolejce",
  processing: "Przetwarzane",
  succeeded: "Ukończone",
  failed: "Niepowodzenie",
  expired: "Wygasło",
};

const STATUS_TONE: Record<GenerationStatus, GenerationHistoryItemViewModel["statusTone"]> = {
  queued: "default",
  processing: "default",
  succeeded: "success",
  failed: "danger",
  expired: "warning",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return DATE_TIME_FORMATTER.format(date);
}

function formatDuration(fromISO: string): string {
  const now = Date.now();
  const target = new Date(fromISO).getTime();
  const diffMs = target - now;

  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return "0m";
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function determineExpiresSoon(expiresAt?: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) {
    return false;
  }

  const sixHours = 6 * 60 * 60 * 1000;
  return target - Date.now() <= sixHours && target > Date.now();
}

function mapSummaryToViewModel(summary: GenerationSummaryDto): GenerationHistoryItemViewModel {
  const expiresSoon = determineExpiresSoon(summary.expiresAt);
  const expiresAtLabel = formatDateLabel(summary.expiresAt);

  const title = `Stylizacja ${summary.id.slice(0, 6).toUpperCase()}`;
  const summaryText =
    summary.status === "succeeded"
      ? "Model zakończył generację – wynik jest gotowy do pobrania."
      : STATUS_LABELS[summary.status];

  const canRate = summary.status === "succeeded";
  const canDownload = summary.status === "succeeded";
  const canDelete = summary.status !== "processing";

  return {
    id: summary.id,
    title,
    summary: summaryText,
    status: summary.status,
    statusLabel: STATUS_LABELS[summary.status],
    statusTone: STATUS_TONE[summary.status],
    createdAtLabel: formatDateLabel(summary.createdAt) ?? "Nieznana data",
    expiresAt: summary.expiresAt ?? null,
    expiresAtLabel,
    expiresInLabel: summary.expiresAt ? formatDuration(summary.expiresAt) : null,
    expiresSoon,
    thumbnailUrl: summary.thumbnailUrl,
    thumbnailAlt: `Wygenerowany obraz ${title}`,
    rating: summary.rating,
    ratingSubmitting: false,
    canRate,
    actions: {
      open: { enabled: true },
      download: canDownload ? { enabled: true } : { enabled: false, disabledReason: "Wynik nie jest gotowy." },
      delete: canDelete ? { enabled: true } : { enabled: false, disabledReason: "Zadanie w toku." },
    },
  };
}

function buildQuery(filters: GenerationHistoryFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? 20));

  if (filters.status.length > 0) {
    params.set("status", filters.status.join(","));
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }

  return params.toString();
}

function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause && "cause" in error) {
    error.cause = cause;
  }
  return error;
}

const useGenerationHistory = ({ filters, cursor, sessionToken }: UseGenerationHistoryProps): UseGenerationHistoryResult => {
  const [items, setItems] = useState<GenerationHistoryItemViewModel[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const queryString = useMemo(() => buildQuery(filters, cursor), [filters, cursor]);

  const fetchHistory = useCallback(
    async (signal?: AbortSignal) => {
      if (!sessionToken) {
        setError(createError("Brak sesji użytkownika – nie można pobrać historii."));
        setItems([]);
        setNextCursor(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/vton/generations?${queryString}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
          signal,
        });

        if (!response.ok) {
          const { error: body } = await response.json().catch(() => ({ error: { message: "Nieznany błąd." } }));
          throw createError(body?.message ?? `Żądanie nie powiodło się (HTTP ${response.status}).`);
        }

        const payload: GenerationListResponseDto = await response.json();
        setItems(payload.items.map(mapSummaryToViewModel));
        setNextCursor(payload.nextCursor);
      } catch (fetchError) {
        if ((fetchError as Error)?.name === "AbortError") {
          return;
        }
        setError(fetchError as Error);
        setItems([]);
        setNextCursor(null);
      } finally {
        setIsLoading(false);
      }
    },
    [queryString, sessionToken],
  );

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchHistory(controller.signal);

    return () => controller.abort();
  }, [fetchHistory]);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    await fetchHistory(controller.signal);
  }, [fetchHistory]);

  return {
    items,
    nextCursor,
    isLoading,
    error,
    refresh,
  };
};

export default useGenerationHistory;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GenerationDetailResponseDto, GenerationQueuedResponseDto } from "@/types.ts";
import {
  buildGenerationStatusViewModel,
  buildStatusMetadata,
  isFinalStatus,
  type GenerationStatusViewModel,
  type StatusMetadataViewModel,
} from "@/lib/vton/status.mapper.ts";
import { getSignedAssetUrl } from "@/lib/vton/assets.ts";

interface UseGenerationStatusOptions {
  intervalMs?: number;
  initialData?: GenerationQueuedResponseDto | null;
  assetBuckets?: {
    persona?: string;
    garment?: string;
  };
}

export interface GenerationStatusError {
  code: string;
  message: string;
  status?: number;
  retriable: boolean;
}

interface FetchState {
  isPolling: boolean;
  abortController: AbortController | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  failureCount: number;
  processingSince: number | null;
}

const FINAL_ERROR_CODES = new Set(["not_found", "expired"]);
const BASE_INTERVAL_MS = 3000;
const PROCESSING_ACCEL_THRESHOLD_MS = 120_000;

export interface UseGenerationStatusResult {
  data: GenerationStatusViewModel | null;
  metadata: StatusMetadataViewModel | null;
  isLoading: boolean;
  isPolling: boolean;
  isFinal: boolean;
  error: GenerationStatusError | null;
  refresh(): Promise<void>;
}

export function useGenerationStatus(
  generationId: string | null | undefined,
  options: UseGenerationStatusOptions = {},
): UseGenerationStatusResult {
  const intervalMs = options.intervalMs ?? BASE_INTERVAL_MS;
  const queuedRef = useRef<GenerationQueuedResponseDto | null>(options.initialData ?? null);

  const [viewModel, setViewModel] = useState<GenerationStatusViewModel | null>(() => {
    if (!queuedRef.current) {
      return null;
    }

    try {
      return buildGenerationStatusViewModel({ queued: queuedRef.current });
    } catch (error) {
      console.error("Failed to build initial generation status view model.", error);
      return null;
    }
  });

  const [metadata, setMetadata] = useState<StatusMetadataViewModel | null>(() => {
    if (!queuedRef.current) {
      return null;
    }

    try {
      return buildStatusMetadata({ queued: queuedRef.current });
    } catch (error) {
      console.error("Failed to build initial generation metadata.", error);
      return null;
    }
  });

  const [error, setError] = useState<GenerationStatusError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!viewModel);
  const [fetchState] = useState<FetchState>(() => ({
    isPolling: false,
    abortController: null,
    timeoutId: null,
    failureCount: 0,
    processingSince: null,
  }));

  const activeGenerationIdRef = useRef<string | null>(generationId ?? null);
  const executeFetchRef = useRef<((manual?: boolean) => Promise<void> | void) | null>(null);

  const resetFetchState = useCallback(() => {
    fetchState.abortController?.abort();

    if (fetchState.timeoutId) {
      clearTimeout(fetchState.timeoutId);
    }

    fetchState.abortController = null;
    fetchState.timeoutId = null;
    fetchState.failureCount = 0;
    fetchState.processingSince = null;
    fetchState.isPolling = false;
  }, [fetchState]);

  useEffect(() => {
    queuedRef.current = options.initialData ?? null;
  }, [options.initialData]);

  useEffect(() => {
    activeGenerationIdRef.current = generationId ?? null;
    resetFetchState();
    setError(null);

    if (!generationId) {
      setViewModel(null);
      setMetadata(null);
      setIsLoading(false);
      return;
    }

    if (queuedRef.current) {
      try {
        setViewModel(
          buildGenerationStatusViewModel({
            queued: queuedRef.current,
          }),
        );
        setMetadata(
          buildStatusMetadata({
            queued: queuedRef.current,
          }),
        );
      } catch (buildError) {
        console.error("Failed to rebuild initial status data.", buildError);
        setViewModel(null);
        setMetadata(null);
      }
    } else {
      setViewModel(null);
      setMetadata(null);
    }

    setIsLoading(true);
  }, [generationId, resetFetchState]);

  useEffect(() => {
    return () => {
      resetFetchState();
    };
  }, [resetFetchState]);

  const schedulePoll = useCallback(
    (status: GenerationStatusViewModel["status"]) => {
      if (!generationId || !activeGenerationIdRef.current || activeGenerationIdRef.current !== generationId) {
        return;
      }

      const baseDelay = intervalMs;
      const failureCount = fetchState.failureCount;

      let delay = baseDelay;

      if (status === "processing" && fetchState.processingSince) {
        const elapsed = Date.now() - fetchState.processingSince;
        if (elapsed >= PROCESSING_ACCEL_THRESHOLD_MS) {
          delay = 1000;
        }
      }

      if (failureCount > 0) {
        const backoffFactor = Math.min(2 ** failureCount, 4);
        delay = baseDelay * backoffFactor;
      }

      if (fetchState.timeoutId) {
        clearTimeout(fetchState.timeoutId);
      }

      fetchState.timeoutId = setTimeout(() => {
        const next = executeFetchRef.current;
        if (next) {
          void next();
        }
      }, delay);
      fetchState.isPolling = true;
    },
    [fetchState, generationId, intervalMs],
  );

  const applyDetail = useCallback(
    async (detail: GenerationDetailResponseDto): Promise<GenerationStatusViewModel> => {
      const personaPath = detail.personaSnapshotPath ?? queuedRef.current?.personaSnapshotPath ?? null;
      const garmentPath = detail.clothSnapshotPath ?? queuedRef.current?.clothSnapshotPath ?? null;

      const [personaPreviewUrl, garmentPreviewUrl] = await Promise.all([
        resolveSignedUrl(personaPath, options.assetBuckets?.persona),
        resolveSignedUrl(garmentPath, options.assetBuckets?.garment),
      ]);

      const model = buildGenerationStatusViewModel({
        queued: queuedRef.current ?? undefined,
        detail,
        personaPreviewUrl: personaPreviewUrl ?? undefined,
        garmentPreviewUrl: garmentPreviewUrl ?? undefined,
      });

      const metadataModel = buildStatusMetadata({
        queued: queuedRef.current ?? undefined,
        detail,
        personaPreviewUrl: personaPreviewUrl ?? undefined,
        garmentPreviewUrl: garmentPreviewUrl ?? undefined,
      });

      if (model.status === "processing") {
        const startedAt = detail.startedAt ?? null;
        if (startedAt) {
          const timestamp = new Date(startedAt).getTime();
          if (Number.isFinite(timestamp)) {
            fetchState.processingSince = timestamp;
          }
        }
      }

      setViewModel(model);
      setMetadata(metadataModel);

      return model;
    },
    [options.assetBuckets?.garment, options.assetBuckets?.persona],
  );

  const handleError = useCallback(
    (input: GenerationStatusError, terminate = false) => {
      setError(input);

      if (terminate || FINAL_ERROR_CODES.has(input.code) || !input.retriable) {
        resetFetchState();
        setIsLoading(false);
        return;
      }

      fetchState.failureCount = Math.min(fetchState.failureCount + 1, 3);
      schedulePoll(viewModel?.status ?? "queued");
    },
    [fetchState, resetFetchState, schedulePoll, viewModel?.status],
  );

  const executeFetch = useCallback(
    async (manual = false) => {
      if (!generationId) {
        handleError(
          {
            code: "missing_id",
            message: "Brakuje identyfikatora generacji, aby pobrać status.",
            retriable: false,
          },
          true,
        );
        return;
      }

      if (!manual && fetchState.abortController?.signal.aborted) {
        fetchState.abortController = null;
      }

      fetchState.abortController?.abort();
      const controller = new AbortController();
      fetchState.abortController = controller;

      try {
        if (manual) {
          setIsLoading(true);
        }

        const response = await fetch(`/api/vton/generations/${generationId}`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          handleError(
            {
              code: "unauthorized",
              message: "Sesja wygasła. Zaloguj się ponownie, aby kontynuować.",
              status: response.status,
              retriable: false,
            },
            true,
          );
          return;
        }

        if (response.status === 404) {
          handleError(
            {
              code: "not_found",
              message: "Nie znaleziono generacji. Została usunięta lub nie istnieje.",
              status: 404,
              retriable: false,
            },
            true,
          );
          return;
        }

        if (response.status === 410) {
          handleError(
            {
              code: "expired",
              message: "Generacja wygasła i nie jest już dostępna.",
              status: 410,
              retriable: false,
            },
            true,
          );
          return;
        }

        if (!response.ok) {
          const body = await safeParseError(response);
          handleError(
            {
              code: body?.error?.code ?? "server_error",
              message: body?.error?.message ?? "Nie udało się pobrać statusu generacji.",
              status: response.status,
              retriable: response.status >= 500,
            },
            response.status < 500,
          );
          return;
        }

        const payload = (await response.json()) as GenerationDetailResponseDto;
        fetchState.failureCount = 0;

        if (!payload) {
          handleError(
            {
              code: "empty_payload",
              message: "Serwer zwrócił pustą odpowiedź.",
              retriable: true,
            },
            false,
          );
          return;
        }

        const model = await applyDetail(payload);
        setError(null);
        setIsLoading(false);

        if (isFinalStatus(model.status)) {
          resetFetchState();
          return;
        }

        schedulePoll(model.status);
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch generation status.", caughtError);
        handleError(
          {
            code: "network_error",
            message: "Nie udało się połączyć z serwerem. Spróbuj ponownie za chwilę.",
            retriable: true,
          },
          false,
        );
      } finally {
        if (manual) {
          setIsLoading(false);
        }
      }
    },
    [applyDetail, fetchState, generationId, handleError, resetFetchState, schedulePoll],
  );

  executeFetchRef.current = executeFetch;

  useEffect(() => {
    if (!generationId) {
      return;
    }

    void executeFetch(false);
  }, [executeFetch, generationId]);

  const refresh = useCallback(async () => {
    await executeFetch(true);
  }, [executeFetch]);

  const isFinal = useMemo(() => {
    if (!viewModel) {
      return false;
    }
    return isFinalStatus(viewModel.status);
  }, [viewModel]);

  return {
    data: viewModel,
    metadata,
    isLoading,
    isPolling: fetchState.isPolling,
    isFinal,
    error,
    refresh,
  };
}

async function resolveSignedUrl(path: string | null, bucket: string | undefined): Promise<string | null> {
  if (!path || !bucket) {
    return null;
  }

  return getSignedAssetUrl(bucket, path);
}

async function safeParseError(response: Response): Promise<
  | {
      error?: {
        code?: string;
        message?: string;
      };
    }
  | null
> {
  try {
    return (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };
  } catch {
    return null;
  }
}

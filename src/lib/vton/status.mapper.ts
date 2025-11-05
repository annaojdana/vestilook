import type {
  GenerationDetailResponseDto,
  GenerationQueuedResponseDto,
  GenerationStatus,
} from "@/types.ts";

import {
  getFailureContext,
  getStatusMessage,
  type FailureActionIntent,
  type FailureContext,
} from "./status-messages.ts";

export type ProgressItemKey = "queued" | "processing" | "succeeded" | "failed" | "expired";

export interface ProgressItem {
  key: ProgressItemKey;
  label: string;
  description?: string;
  timestamp?: string | null;
  isCurrent: boolean;
  isCompleted: boolean;
  tone: "info" | "success" | "warning" | "error";
}

export interface StatusActionPermissions {
  canViewResult: boolean;
  canDownload: boolean;
  canRetry: boolean;
  canRate: boolean;
  canKeepWorking: boolean;
  disabledReason?: string;
}

export type StatusActionIntent =
  | "view-result"
  | "retry"
  | "download"
  | "rate"
  | "keep-working"
  | "close";

export interface GenerationStatusViewModel {
  id: string;
  status: GenerationStatus;
  statusLabel: string;
  statusDescription: string;
  personaPreviewUrl?: string;
  garmentPreviewUrl?: string;
  resultUrl?: string;
  vertexJobId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  failureContext?: FailureContext | null;
  etaSeconds?: number | null;
  etaTarget?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  timeline: ProgressItem[];
  actions: StatusActionPermissions;
  quotaRemaining?: number | null;
}

export interface StatusMetadataViewModel {
  personaPath?: string | null;
  garmentPath?: string | null;
  personaPreviewUrl?: string;
  garmentPreviewUrl?: string;
  vertexJobId?: string | null;
  generationId: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  quotaRemaining?: number | null;
}

export interface EtaCountdownViewModel {
  targetTime: string;
  initialSeconds: number;
  formattedRemaining: string;
  isExpired: boolean;
}

const KNOWN_STATUSES: GenerationStatus[] = ["queued", "processing", "succeeded", "failed", "expired"];
const FINAL_STATUSES: GenerationStatus[] = ["succeeded", "failed", "expired"];
const PROGRESS_SEQUENCE: ProgressItemKey[] = ["queued", "processing", "succeeded", "failed", "expired"];
const PROGRESS_TONE: Record<ProgressItemKey, ProgressItem["tone"]> = {
  queued: "info",
  processing: "info",
  succeeded: "success",
  failed: "error",
  expired: "warning",
};

const DEFAULT_NOW = () => new Date();

export interface BuildStatusViewModelParams {
  queued?: GenerationQueuedResponseDto | null;
  detail?: GenerationDetailResponseDto | null;
  personaPreviewUrl?: string | null;
  garmentPreviewUrl?: string | null;
  resultUrl?: string | null;
  now?: () => Date;
}

export interface BuildMetadataParams {
  queued?: GenerationQueuedResponseDto | null;
  detail?: GenerationDetailResponseDto | null;
  personaPreviewUrl?: string | null;
  garmentPreviewUrl?: string | null;
}

export function isFinalStatus(status: GenerationStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export function buildGenerationStatusViewModel(
  params: BuildStatusViewModelParams,
): GenerationStatusViewModel {
  const { queued = null, detail = null, personaPreviewUrl, garmentPreviewUrl, resultUrl } = params;
  const now = params.now ?? DEFAULT_NOW;

  const source = detail ?? queued;
  if (!source) {
    throw new Error("Generation payload is required to build status view model.");
  }

  const id = source.id;
  if (!id) {
    throw new Error("Generation identifier is required to build status view model.");
  }

  const rawStatus = normalizeStatus(detail?.status ?? queued?.status);
  const expiresAt = detail?.expiresAt ?? queued?.expiresAt ?? null;
  const status = enforceExpiry(rawStatus, expiresAt, now);

  const statusMessage = getStatusMessage(status);
  const failureCode = resolveFailureCode({
    status,
    errorReason: detail?.errorReason ?? null,
    resultPath: detail?.resultPath ?? null,
  });
  const failureContext = getFailureContext(failureCode);

  const createdAt = detail?.createdAt ?? queued?.createdAt;
  if (!createdAt) {
    throw new Error("Creation timestamp is required to build status view model.");
  }

  const startedAt = detail?.startedAt ?? null;
  const completedAt = detail?.completedAt ?? null;

  const effectiveResultUrl = resultUrl ?? undefined;
  const hasResultPath = Boolean(detail?.resultPath);
  const hasResultAsset = Boolean(effectiveResultUrl ?? hasResultPath);

  const actions = deriveActionPermissions({
    status,
    hasResultAsset,
    hasResultUrl: Boolean(effectiveResultUrl),
    failureContext,
  });

  const etaSeconds = queued?.etaSeconds ?? null;
  const etaTarget = computeEtaTarget({
    createdAt,
    etaSeconds,
    completedAt,
    expiresAt,
    status,
  });

  const timeline = buildTimeline({
    status,
    createdAt,
    startedAt,
    completedAt,
    expiresAt,
  });

  return {
    id,
    status,
    statusLabel: statusMessage.label,
    statusDescription: resolveStatusDescription(status, statusMessage.description, failureContext),
    personaPreviewUrl: personaPreviewUrl ?? undefined,
    garmentPreviewUrl: garmentPreviewUrl ?? undefined,
    resultUrl: effectiveResultUrl,
    vertexJobId: detail?.vertexJobId ?? queued?.vertexJobId ?? null,
    errorCode: failureCode ?? null,
    errorMessage: failureContext?.description ?? null,
    failureContext,
    etaSeconds,
    etaTarget,
    createdAt,
    startedAt,
    completedAt,
    expiresAt: expiresAt ?? null,
    timeline,
    actions,
    quotaRemaining: queued?.quota?.remainingFree ?? null,
  };
}

export function buildStatusMetadata(params: BuildMetadataParams): StatusMetadataViewModel {
  const { queued = null, detail = null, personaPreviewUrl, garmentPreviewUrl } = params;
  const source = detail ?? queued;

  if (!source) {
    throw new Error("Generation payload is required to build status metadata.");
  }

  if (!source.id) {
    throw new Error("Generation identifier is required to build status metadata.");
  }

  const createdAt = detail?.createdAt ?? queued?.createdAt;
  if (!createdAt) {
    throw new Error("Creation timestamp is required to build status metadata.");
  }

  return {
    generationId: source.id,
    personaPath: detail?.personaSnapshotPath ?? queued?.personaSnapshotPath ?? null,
    garmentPath: detail?.clothSnapshotPath ?? queued?.clothSnapshotPath ?? null,
    personaPreviewUrl: personaPreviewUrl ?? undefined,
    garmentPreviewUrl: garmentPreviewUrl ?? undefined,
    vertexJobId: detail?.vertexJobId ?? queued?.vertexJobId ?? null,
    createdAt,
    startedAt: detail?.startedAt ?? null,
    completedAt: detail?.completedAt ?? null,
    expiresAt: detail?.expiresAt ?? queued?.expiresAt ?? null,
    quotaRemaining: queued?.quota?.remainingFree ?? null,
  };
}

export function buildEtaCountdownViewModel(
  etaTarget: string | null | undefined,
  etaSeconds: number | null | undefined,
  now: () => Date = DEFAULT_NOW,
): EtaCountdownViewModel | null {
  if (!etaTarget || typeof etaSeconds !== "number") {
    return null;
  }

  const targetDate = new Date(etaTarget);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const millisecondsRemaining = targetDate.getTime() - now().getTime();
  const secondsRemaining = Math.max(Math.floor(millisecondsRemaining / 1000), 0);

  return {
    targetTime: etaTarget,
    initialSeconds: etaSeconds,
    formattedRemaining: formatDuration(secondsRemaining),
    isExpired: secondsRemaining <= 0,
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

interface FailureCodeInput {
  status: GenerationStatus;
  errorReason: string | null;
  resultPath: string | null;
}

function resolveFailureCode(input: FailureCodeInput): string | null {
  if (input.status === "succeeded" && !input.resultPath) {
    return "missing_result";
  }

  if (input.status === "failed" && input.errorReason) {
    return input.errorReason;
  }

  if (input.status === "expired") {
    return "expired";
  }

  return input.errorReason ?? null;
}

function resolveStatusDescription(
  status: GenerationStatus,
  fallback: string,
  failureContext: FailureContext | null | undefined,
): string {
  if (status === "failed" && failureContext) {
    return failureContext.description;
  }

  if (status === "expired") {
    return "Generacja przekroczyła czas przechowywania i została automatycznie usunięta.";
  }

  return fallback;
}

interface ActionInput {
  status: GenerationStatus;
  hasResultAsset: boolean;
  hasResultUrl: boolean;
  failureContext: FailureContext | null;
}

function deriveActionPermissions(input: ActionInput): StatusActionPermissions {
  const base: StatusActionPermissions = {
    canViewResult: false,
    canDownload: false,
    canRetry: false,
    canRate: false,
    canKeepWorking: false,
    disabledReason: undefined,
  };

  if (input.status === "succeeded") {
    base.canViewResult = true;
    base.canRate = true;
    base.canDownload = input.hasResultAsset;

    if (!input.hasResultUrl) {
      base.disabledReason = "Link do pobrania jest chwilowo niedostępny.";
    }
  }

  if (input.status === "failed" || input.status === "expired") {
    base.canRetry = true;
  }

  if (input.status === "processing" || input.status === "queued") {
    base.canKeepWorking = true;
  }

  if (input.failureContext?.code === "quota_exhausted") {
    base.canRetry = false;
    base.disabledReason = "Limit generacji został przekroczony.";
  }

  return base;
}

interface TimelineInput {
  status: GenerationStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

function buildTimeline(input: TimelineInput): ProgressItem[] {
  const currentIndex = PROGRESS_SEQUENCE.findIndex((step) => step === input.status);
  const safeIndex = currentIndex >= 0 ? currentIndex : PROGRESS_SEQUENCE.indexOf("failed");

  return PROGRESS_SEQUENCE.map((key, index) => {
    const isCurrent = index === safeIndex;
    const isCompleted = index < safeIndex || (isCurrent && isFinalStatus(input.status));

    return {
      key,
      label: timelineLabel(key),
      description: timelineDescription(key),
      timestamp: timelineTimestamp(key, input),
      isCurrent,
      isCompleted,
      tone: PROGRESS_TONE[key],
    };
  }).filter((item) => {
    if (input.status === "succeeded") {
      return item.key !== "failed" && item.key !== "expired";
    }

    if (input.status === "failed") {
      return item.key !== "succeeded" && item.key !== "expired";
    }

    if (input.status === "expired") {
      return item.key !== "succeeded" && item.key !== "failed";
    }

    return true;
  });
}

function timelineLabel(key: ProgressItemKey): string {
  switch (key) {
    case "queued":
      return "W kolejce";
    case "processing":
      return "Przetwarzanie";
    case "succeeded":
      return "Zakończono";
    case "failed":
      return "Niepowodzenie";
    case "expired":
      return "Wygasło";
    default:
      return "Status";
  }
}

function timelineDescription(key: ProgressItemKey): string {
  switch (key) {
    case "queued":
      return "Zgłoszenie zostało przyjęte i oczekuje na start.";
    case "processing":
      return "Vertex AI generuje wynik na podstawie dostarczonych danych.";
    case "succeeded":
      return "Wynik został zapisany w magazynie i jest gotowy do pobrania.";
    case "failed":
      return "Generacja została zatrzymana z powodu błędu.";
    case "expired":
      return "Pliki wygasły zgodnie z polityką retencji.";
    default:
      return "";
  }
}

function timelineTimestamp(key: ProgressItemKey, input: TimelineInput): string | null | undefined {
  switch (key) {
    case "queued":
      return input.createdAt;
    case "processing":
      return input.startedAt;
    case "succeeded":
      return input.completedAt;
    case "failed":
      return input.completedAt;
    case "expired":
      return input.expiresAt;
    default:
      return undefined;
  }
}

interface EtaInput {
  createdAt: string;
  etaSeconds: number | null;
  completedAt: string | null;
  expiresAt: string | null;
  status: GenerationStatus;
}

function computeEtaTarget(input: EtaInput): string | null {
  if (!input.createdAt || input.etaSeconds === null || input.etaSeconds === undefined) {
    return null;
  }

  const created = new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) {
    return null;
  }

  const predicted = new Date(created.getTime() + input.etaSeconds * 1000);

  if (isFinalStatus(input.status)) {
    if (input.completedAt) {
      return input.completedAt;
    }

    return predicted.toISOString();
  }

  if (input.expiresAt) {
    const expires = new Date(input.expiresAt);
    if (!Number.isNaN(expires.getTime()) && expires < predicted) {
      return expires.toISOString();
    }
  }

  return predicted.toISOString();
}

function normalizeStatus(status: GenerationStatus | null | undefined): GenerationStatus {
  if (status && KNOWN_STATUSES.includes(status)) {
    return status;
  }

  return "failed";
}

function enforceExpiry(
  status: GenerationStatus,
  expiresAt: string | null,
  now: () => Date,
): GenerationStatus {
  if (!expiresAt) {
    return status;
  }

  const expiryDate = new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime())) {
    return status;
  }

  if (expiryDate.getTime() <= now().getTime()) {
    return "expired";
  }

  return status;
}


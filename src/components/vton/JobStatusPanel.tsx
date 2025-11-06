import { useCallback, useEffect, useMemo } from "react";
import type { JSX } from "react";

import type { GenerationQueuedResponseDto } from "@/types.ts";
import {
  type EtaCountdownViewModel,
  type GenerationStatusViewModel,
  type StatusActionIntent,
  type StatusActionPermissions,
} from "@/lib/vton/status.mapper.ts";
import type { FailureActionIntent } from "@/lib/vton/status-messages.ts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useGenerationStatus } from "./hooks/useGenerationStatus.ts";
import { useEtaCountdown } from "./hooks/useEtaCountdown.ts";
import { useStatusAnnouncements } from "./hooks/useStatusAnnouncements.ts";
import { JobStatusHeader } from "./JobStatusHeader.tsx";
import { StatusActionBar } from "./StatusActionBar.tsx";
import { ProgressTimeline } from "./ProgressTimeline.tsx";
import { StatusMetadataSection } from "./StatusMetadataSection.tsx";
import { FailureHelpCTA } from "./FailureHelpCTA.tsx";
import { JobStatusFooter } from "./JobStatusFooter.tsx";

interface AssetBucketConfig {
  persona?: string;
  garment?: string;
}

export interface JobStatusPanelProps {
  open: boolean;
  generationId: string;
  initialData?: GenerationQueuedResponseDto;
  assetBuckets?: AssetBucketConfig;
  onClose(): void;
  onNavigateToResult(id: string): void;
  onRetry?(id: string): void;
  onStatusChange?(viewModel: GenerationStatusViewModel): void;
}

export function JobStatusPanel(props: JobStatusPanelProps): JSX.Element {
  const { open, generationId, initialData, assetBuckets, onClose, onNavigateToResult, onRetry, onStatusChange } = props;

  const state = useGenerationStatus(generationId, {
    initialData,
    assetBuckets,
  });

  const etaCountdownState = useEtaCountdown(state.data?.etaTarget ?? null, {
    status: state.data?.status ?? null,
    initialSeconds: state.data?.etaSeconds ?? null,
  });

  const etaViewModel = useMemo<EtaCountdownViewModel | null>(() => {
    if (!state.data?.etaTarget || !etaCountdownState.formatted) {
      return null;
    }

    return {
      targetTime: state.data.etaTarget,
      initialSeconds: state.data.etaSeconds ?? etaCountdownState.secondsRemaining ?? 0,
      formattedRemaining: etaCountdownState.formatted,
      isExpired: etaCountdownState.isExpired,
    };
  }, [etaCountdownState.formatted, etaCountdownState.isExpired, etaCountdownState.secondsRemaining, state.data]);

  const { announcement } = useStatusAnnouncements(state.data);

  useEffect(() => {
    if (state.data && onStatusChange) {
      onStatusChange(state.data);
    }
  }, [onStatusChange, state.data]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose],
  );

  const handleAction = useCallback(
    (intent: StatusActionIntent) => {
      if (!state.data) {
        return;
      }

      switch (intent) {
        case "view-result":
          onNavigateToResult(state.data.id);
          onClose();
          break;
        case "retry":
          onRetry?.(state.data.id);
          break;
        case "download":
          // Download handling will be implemented alongside action bar details.
          break;
        case "keep-working":
          onClose();
          break;
        case "close":
          onClose();
          break;
        case "rate":
          // Rating CTA handled in later implementation phase.
          break;
        default:
          break;
      }
    },
    [onClose, onNavigateToResult, onRetry, state.data],
  );

  const handleFailureAction = useCallback(
    (intent: FailureActionIntent) => {
      if (intent === "retry") {
        handleAction("retry");
        return;
      }

      if (intent === "reupload-garment") {
        handleAction("keep-working");
        return;
      }

      // Pozostałe akcje obsługiwane są w samym komponencie (np. link do wsparcia).
    },
    [handleAction],
  );

  const actionPermissions: StatusActionPermissions | undefined = state.data?.actions;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[min(90vh,_720px)] max-w-3xl flex-col overflow-hidden p-0 sm:h-[640px]">
        <div
          aria-live={announcement?.tone === "assertive" ? "assertive" : "polite"}
          className="sr-only"
        >
          {announcement?.message ?? ""}
        </div>

        <div className="flex flex-1 flex-col">
          <JobStatusHeader
            status={state.data?.status ?? "queued"}
            statusLabel={state.data?.statusLabel ?? "Ładowanie statusu"}
            statusDescription={state.data?.statusDescription ?? "Trwa pobieranie informacji o generacji."}
            eta={etaViewModel}
            onClose={onClose}
            isLoading={state.isLoading}
            vertexJobId={state.data?.vertexJobId ?? null}
          />

          {actionPermissions ? (
            <StatusActionBar
              actions={actionPermissions}
              busy={state.isLoading}
              onAction={handleAction}
            />
          ) : null}

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-6">
              {state.error ? (
                <Alert variant="destructive">
                  <AlertTitle>Problemy z połączeniem</AlertTitle>
                  <AlertDescription>
                    {state.error.message}
                    {state.error.retriable ? " Spróbujemy ponownie automatycznie." : ""}
                  </AlertDescription>
                  {state.error.retriable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => void state.refresh()}
                    >
                      Odśwież teraz
                    </Button>
                  ) : null}
                </Alert>
              ) : null}

              {state.data?.timeline ? (
                <ProgressTimeline
                  steps={state.data.timeline}
                  currentKey={state.data.status}
                />
              ) : null}

              {state.data?.failureContext ? (
                <FailureHelpCTA context={state.data.failureContext} onAction={handleFailureAction} />
              ) : null}

              {state.metadata ? (
                <StatusMetadataSection
                  metadata={state.metadata}
                  loading={state.isLoading}
                />
              ) : null}
            </div>
          </ScrollArea>

          <JobStatusFooter
            viewModel={state.data}
            onClose={onClose}
            onAction={handleAction}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

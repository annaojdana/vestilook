import type { JSX } from "react";

import type { EtaCountdownViewModel, GenerationStatusViewModel } from "@/lib/vton/status.mapper.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { CheckCircle2, Clock, Hourglass, Loader2, ShieldAlert, X as XIcon, XCircle } from "lucide-react";

export interface JobStatusHeaderProps {
  status: GenerationStatusViewModel["status"];
  statusLabel: string;
  statusDescription: string;
  eta: EtaCountdownViewModel | null;
  onClose(): void;
  isLoading: boolean;
  vertexJobId: string | null;
}

export function JobStatusHeader({ status, statusLabel, statusDescription, eta, onClose, isLoading, vertexJobId }: JobStatusHeaderProps): JSX.Element {
  const statusConfig = getStatusPresentation(status);

  return (
    <header className="border-b px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusConfig.badgeVariant} className={statusConfig.badgeClassName}>
              <statusConfig.icon className={statusConfig.iconClassName} aria-hidden="true" />
              {statusConfig.label}
            </Badge>

            {eta && !eta.isExpired ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                <Clock className="size-3.5" aria-hidden="true" />
                {eta.formattedRemaining}
              </span>
            ) : null}

            {isLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Aktualizacja
              </span>
            ) : null}
          </div>

          <DialogTitle className="flex items-center gap-2 text-xl font-semibold leading-6 text-foreground">
            {statusLabel}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground">
            {statusDescription}
            {vertexJobId ? (
              <span className="ml-2 inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                {truncate(vertexJobId)}
              </span>
            ) : null}
          </DialogDescription>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-1 shrink-0"
          onClick={onClose}
        >
          <XIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Zamknij panel statusu</span>
        </Button>
      </div>
    </header>
  );
}

function getStatusPresentation(status: GenerationStatusViewModel["status"]) {
  switch (status) {
    case "queued":
      return {
        label: "W kolejce",
        badgeVariant: "outline" as const,
        badgeClassName: "border-amber-500/40 text-amber-700 bg-amber-500/10",
        icon: Hourglass,
        iconClassName: "size-3.5",
      };
    case "processing":
      return {
        label: "Przetwarzanie",
        badgeVariant: "default" as const,
        badgeClassName: "bg-primary text-primary-foreground",
        icon: Loader2,
        iconClassName: "size-3.5 animate-spin",
      };
    case "succeeded":
      return {
        label: "Zakończono",
        badgeVariant: "secondary" as const,
        badgeClassName: "",
        icon: CheckCircle2,
        iconClassName: "size-3.5",
      };
    case "failed":
      return {
        label: "Niepowodzenie",
        badgeVariant: "destructive" as const,
        badgeClassName: "",
        icon: XCircle,
        iconClassName: "size-3.5",
      };
    case "expired":
      return {
        label: "Wygasło",
        badgeVariant: "outline" as const,
        badgeClassName: "border-muted bg-muted/40 text-muted-foreground",
        icon: ShieldAlert,
        iconClassName: "size-3.5",
      };
    default:
      return {
        label: "Status",
        badgeVariant: "outline" as const,
        badgeClassName: "",
        icon: Hourglass,
        iconClassName: "size-3.5",
      };
  }
}

function truncate(value: string, max = 18): string {
  if (value.length <= max) {
    return value;
  }

  const head = value.slice(0, Math.ceil(max / 2) - 1);
  const tail = value.slice(-Math.floor(max / 2));
  return `${head}…${tail}`;
}

import type { JSX, ReactNode } from "react";

import type { GenerationStatusViewModel, StatusActionIntent } from "@/lib/vton/status.mapper.ts";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { Clock, Coins, FileClock, Info } from "lucide-react";

export interface JobStatusFooterProps {
  viewModel: GenerationStatusViewModel | null;
  onClose(): void;
  onAction(intent: StatusActionIntent): void;
}

export function JobStatusFooter({ viewModel, onClose, onAction }: JobStatusFooterProps): JSX.Element {
  const chips = buildChips(viewModel);

  return (
    <footer className="border-t bg-background/80 px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <InfoChip key={chip.label} icon={chip.icon} tone={chip.tone}>
              <span className="text-xs font-medium text-muted-foreground">{chip.label}</span>
              <span className="text-sm text-foreground">{chip.value}</span>
            </InfoChip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onAction("close");
              onClose();
            }}
          >
            Zamknij
          </Button>
        </div>
      </div>
    </footer>
  );
}

interface ChipDescriptor {
  label: string;
  value: string;
  icon: JSX.Element;
  tone: "default" | "warning" | "info";
}

function buildChips(viewModel: GenerationStatusViewModel | null): ChipDescriptor[] {
  if (!viewModel) {
    return [];
  }

  const descriptors: ChipDescriptor[] = [];

  if (viewModel.expiresAt) {
    descriptors.push({
      label: "Wygasa",
      value: formatDate(viewModel.expiresAt),
      icon: <Clock className="size-3.5" aria-hidden="true" />,
      tone: viewModel.status === "expired" ? "warning" : "default",
    });
  }

  if (typeof viewModel.quotaRemaining === "number") {
    descriptors.push({
      label: "Darmowe generacje",
      value: `${viewModel.quotaRemaining}`,
      icon: <Coins className="size-3.5" aria-hidden="true" />,
      tone: viewModel.quotaRemaining > 0 ? "default" : "warning",
    });
  }

  descriptors.push({
    label: "Status",
    value: viewModel.statusLabel,
    icon: <Info className="size-3.5" aria-hidden="true" />,
    tone: "info",
  });

  if (viewModel.completedAt) {
    descriptors.push({
      label: "Zakończono",
      value: formatDate(viewModel.completedAt),
      icon: <FileClock className="size-3.5" aria-hidden="true" />,
      tone: "default",
    });
  }

  return descriptors;
}

interface InfoChipProps {
  children: ReactNode;
  icon: JSX.Element;
  tone: "default" | "warning" | "info";
}

function InfoChip({ children, icon, tone }: InfoChipProps): JSX.Element {
  const tones: Record<InfoChipProps["tone"], string> = {
    default: "border-muted bg-muted/40",
    warning: "border-amber-500/40 bg-amber-500/10",
    info: "border-primary/40 bg-primary/10",
  };

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-1", tones[tone])}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex flex-col leading-tight">{children}</span>
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(date);
}

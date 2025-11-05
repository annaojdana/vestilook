import { useMemo } from "react";
import type { JSX } from "react";

import type { ProgressItem, ProgressItemKey } from "@/lib/vton/status.mapper.ts";
import { cn } from "@/lib/utils.ts";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, Clock, Timer } from "lucide-react";

export interface ProgressTimelineProps {
  steps: ProgressItem[];
  currentKey: ProgressItemKey;
}

const toneStyles: Record<ProgressItem["tone"], string> = {
  info: "border-primary/40 bg-primary/5 text-primary",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const iconByKey: Partial<Record<ProgressItemKey, typeof CheckCircle2>> = {
  queued: Clock,
  processing: Timer,
  succeeded: CheckCircle2,
  failed: AlertTriangle,
  expired: AlertTriangle,
};

export function ProgressTimeline({ steps, currentKey }: ProgressTimelineProps): JSX.Element {
  const formatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }), []);

  return (
    <section aria-label="Postęp generacji" className="rounded-lg border bg-muted/10 p-4">
      <ol className="relative flex flex-col gap-4 text-sm">
        {steps.map((step, index) => {
          const isCurrent = step.key === currentKey;
          const Icon = iconByKey[step.key] ?? Circle;
          const iconClass = cn("size-4", {
            "animate-spin": step.key === "processing" && isCurrent,
          });

          return (
            <li
              key={step.key}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "relative flex gap-3 rounded-md border border-transparent bg-background/60 px-4 py-3 transition-colors",
                step.isCompleted ? "border-primary/20" : "border-muted/40"
              )}
            >
              <div className="relative flex h-full flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border bg-background shadow-sm",
                    toneStyles[step.tone]
                  )}
                >
                  {step.isCompleted ? (
                    <CheckCircle2 className="size-4" />
                  ) : isCurrent ? (
                    <CircleDot className="size-4" />
                  ) : (
                    <Icon className={iconClass} />
                  )}
                </span>

                {index < steps.length - 1 ? <span className="mt-1 h-full w-px flex-1 bg-border" /> : null}
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <span className="font-medium text-foreground">{step.label}</span>
                {step.description ? <span className="text-xs text-muted-foreground">{step.description}</span> : null}
                <time className="text-xs text-muted-foreground">
                  {step.timestamp ? formatter.format(new Date(step.timestamp)) : "—"}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

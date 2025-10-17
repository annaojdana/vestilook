import { forwardRef } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ConsentErrorState } from "./consent-types.ts";

type Tone = "neutral" | "success" | "error" | "pending";

interface InlineFeedbackRegionProps {
  id: string;
  error?: ConsentErrorState | null;
  message?: string;
  tone?: Tone;
  className?: string;
}

const iconByTone: Record<Tone, JSX.Element> = {
  neutral: <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
  success: <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />,
  error: <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />,
  pending: <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />,
};

const toneClasses: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  success: "text-emerald-700",
  error: "text-destructive",
  pending: "text-primary",
};

export const InlineFeedbackRegion = forwardRef<HTMLDivElement, InlineFeedbackRegionProps>(
  ({ id, error, message, tone = "neutral", className }, ref) => {
    const resolvedTone: Tone = error ? "error" : tone;
    const text = error ? error.message : message;

    return (
      <div
        ref={ref}
        id={id}
        role={text ? "alert" : "status"}
        aria-live="assertive"
        tabIndex={text ? -1 : undefined}
        className={cn(
          "flex min-h-[1.5rem] items-start gap-2 text-sm transition-opacity",
          toneClasses[resolvedTone],
          text ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {text ? iconByTone[resolvedTone] : null}
        <span>{text ?? " "}</span>
      </div>
    );
  }
);

InlineFeedbackRegion.displayName = "InlineFeedbackRegion";

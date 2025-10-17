import { createPortal } from "react-dom";
import type { FC, ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import type { PersonaUploaderStatus, UploadProgress } from "@/types.ts";

interface ProgressToastProps {
  progress: UploadProgress | null;
  status: PersonaUploaderStatus;
  message?: ReactNode;
}

const ProgressToast: FC<ProgressToastProps> = ({ progress, status, message }) => {
  if (typeof window === "undefined") {
    return null;
  }

  const active = status === "uploading" && progress;
  if (!active) {
    return null;
  }

  return createPortal(
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4"
    >
      <div className="flex w-full max-w-lg items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-4 py-3 shadow-xl backdrop-blur">
        <Loader2Icon className="size-5 animate-spin text-primary" aria-hidden="true" />
        <div className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-semibold text-foreground">
            {message ?? "Przesyłanie persony w toku..."}
          </span>
          <ProgressBar progress={progress.percentage} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{progress.percentage}%</span>
      </div>
    </div>,
    document.body
  );
};

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      />
    </div>
  );
};

export default ProgressToast;

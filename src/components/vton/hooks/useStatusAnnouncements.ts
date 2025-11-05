import { useCallback, useEffect, useRef, useState } from "react";

import type { GenerationStatusViewModel } from "@/lib/vton/status.mapper.ts";

export interface StatusAnnouncement {
  message: string;
  tone: "polite" | "assertive";
}

interface UseStatusAnnouncementsOptions {
  disabled?: boolean;
}

export interface StatusAnnouncementsState {
  announcement: StatusAnnouncement | null;
  announce(message: string, tone?: StatusAnnouncement["tone"]): void;
  clear(): void;
}

const ASSERTIVE_STATUSES: GenerationStatusViewModel["status"][] = ["succeeded", "failed", "expired"];

export function useStatusAnnouncements(
  viewModel: GenerationStatusViewModel | null,
  options: UseStatusAnnouncementsOptions = {},
): StatusAnnouncementsState {
  const [announcement, setAnnouncement] = useState<StatusAnnouncement | null>(null);
  const lastStatusRef = useRef<GenerationStatusViewModel["status"] | null>(null);
  const lastDescriptionRef = useRef<string | null>(null);

  const announce = useCallback(
    (message: string, tone: StatusAnnouncement["tone"] = "polite") => {
      if (options.disabled) {
        return;
      }

      setAnnouncement({ message, tone });
    },
    [options.disabled],
  );

  const clear = useCallback(() => {
    setAnnouncement(null);
  }, []);

  useEffect(() => {
    if (!viewModel || options.disabled) {
      return;
    }

    const { status, statusLabel, statusDescription } = viewModel;

    const statusChanged = lastStatusRef.current !== status;
    const descriptionChanged = lastDescriptionRef.current !== statusDescription;

    if (!statusChanged && !descriptionChanged) {
      return;
    }

    lastStatusRef.current = status;
    lastDescriptionRef.current = statusDescription;

    const tone: StatusAnnouncement["tone"] = ASSERTIVE_STATUSES.includes(status) ? "assertive" : "polite";
    const message = [statusLabel, statusDescription].filter(Boolean).join(". ");

    if (message.length > 0) {
      setAnnouncement({ message, tone });
    }
  }, [options.disabled, viewModel]);

  return {
    announcement,
    announce,
    clear,
  };
}


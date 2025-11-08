import { AlertTriangleIcon, TimerIcon } from "lucide-react";
import type { FC } from "react";

import useCountdown, { type CountdownState } from "./hooks/useCountdown";

import type { GenerationStatus } from "../../../types";

interface TTLWarningBadgeProps {
  expiresAt?: string | null;
  expiresAtLabel?: string | null;
  expiresInLabel?: string | null;
  status: GenerationStatus;
}

const toneClass: Record<CountdownState["severity"], string> = {
  neutral: "border-border/60 bg-muted/30 text-muted-foreground",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  danger: "border-destructive/50 bg-destructive/10 text-destructive",
} as const;

const TTLWarningBadge: FC<TTLWarningBadgeProps> = ({ expiresAt, expiresAtLabel, expiresInLabel, status }) => {
  const countdown = useCountdown(expiresAt);
  const hasExpiry = Boolean(expiresAt);
  const expired = status === "expired" || countdown.isExpired;

  if (!hasExpiry && !expired) {
    return null;
  }

  const severity = expired ? "danger" : countdown.severity;
  const Icon = expired ? AlertTriangleIcon : TimerIcon;
  const liveLabel = expired
    ? expiresAtLabel
      ? `Wynik wygasł ${expiresAtLabel}`
      : "Wynik wygasł"
    : `Wygasa za ${expiresInLabel ?? countdown.remainingLabel}`;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium ${toneClass[severity]}`}
      aria-live="polite"
    >
      <Icon className="size-4 flex-shrink-0" aria-hidden="true" />
      <div className="flex flex-col text-left leading-tight">
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">
          {expired ? "Wynik wygasł" : "Czas życia wyniku"}
        </span>
        <span className="text-sm">{liveLabel}</span>
        {expiresAtLabel ? (
          <span className="text-xs text-muted-foreground/80">Data usunięcia: {expiresAtLabel}</span>
        ) : null}
      </div>
    </div>
  );
};

export default TTLWarningBadge;

import { useEffect, useState } from "react";

export interface CountdownState {
  remainingMs: number;
  remainingLabel: string;
  severity: "neutral" | "warning" | "danger";
  isExpired: boolean;
  nextTickMs: number;
}

const DEFAULT_STATE: CountdownState = {
  remainingMs: 0,
  remainingLabel: "N/A",
  severity: "neutral",
  isExpired: false,
  nextTickMs: 60_000,
};

function formatRemainingLabel(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "Wygasło";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function determineSeverity(remainingMs: number): CountdownState["severity"] {
  if (remainingMs <= 0) {
    return "danger";
  }
  if (remainingMs <= 60 * 60 * 1000) {
    return "danger";
  }
  if (remainingMs <= 24 * 60 * 60 * 1000) {
    return "warning";
  }
  return "neutral";
}

function determineNextTick(remainingMs: number): number {
  if (remainingMs <= 0) {
    return 60_000;
  }
  if (remainingMs <= 60 * 1000) {
    return 500;
  }
  if (remainingMs <= 60 * 60 * 1000) {
    return 1_000;
  }
  if (remainingMs <= 24 * 60 * 60 * 1000) {
    return 15_000;
  }
  return 60_000;
}

const useCountdown = (expiresAt?: string | null): CountdownState => {
  const [countdown, setCountdown] = useState<CountdownState>(DEFAULT_STATE);

  useEffect(() => {
    if (!expiresAt) {
      setCountdown(DEFAULT_STATE);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleTick = () => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const remainingMs = expires - now;
      const severity = determineSeverity(remainingMs);
      const nextTickMs = determineNextTick(remainingMs);
      const isExpired = remainingMs <= 0;

      if (!cancelled) {
        setCountdown({
          remainingMs,
          remainingLabel: formatRemainingLabel(remainingMs),
          severity,
          isExpired,
          nextTickMs,
        });
      }

      if (!isExpired && !cancelled) {
        timeoutId = setTimeout(scheduleTick, nextTickMs);
      }
    };

    scheduleTick();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [expiresAt]);

  return countdown;
};

export default useCountdown;

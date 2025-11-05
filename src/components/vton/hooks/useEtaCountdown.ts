import { useEffect, useMemo, useRef, useState } from "react";

import type { GenerationStatus } from "@/types.ts";
import { formatDuration, isFinalStatus } from "@/lib/vton/status.mapper.ts";

interface UseEtaCountdownOptions {
  status: GenerationStatus | null | undefined;
  initialSeconds?: number | null;
  onElapsed?(): void;
}

export interface EtaCountdownState {
  secondsRemaining: number | null;
  formatted: string | null;
  isExpired: boolean;
  isActive: boolean;
}

const TICK_INTERVAL_MS = 1000;

export function useEtaCountdown(
  targetTime: string | null | undefined,
  options: UseEtaCountdownOptions,
): EtaCountdownState {
  const { initialSeconds = null, onElapsed, status } = options;
  const initialRemaining = useMemo(
    () => computeRemainingSeconds(targetTime, initialSeconds),
    [initialSeconds, targetTime],
  );

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(initialRemaining);
  const elapsedFiredRef = useRef(false);

  const isFinal = status ? isFinalStatus(status) : false;
  const isActive = Boolean(targetTime) && !isFinal && (secondsRemaining === null || secondsRemaining > 0);

  useEffect(() => {
    setSecondsRemaining(initialRemaining);
    elapsedFiredRef.current = false;
  }, [initialRemaining]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const tick = () => {
      const remaining = computeRemainingSeconds(targetTime, initialSeconds);
      setSecondsRemaining(remaining);

      if (remaining !== null && remaining <= 0 && !elapsedFiredRef.current) {
        elapsedFiredRef.current = true;
        onElapsed?.();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [initialSeconds, isActive, onElapsed, targetTime]);

  const formatted = useMemo(() => {
    if (secondsRemaining === null) {
      return null;
    }

    const bounded = Math.max(secondsRemaining, 0);
    return formatDuration(bounded);
  }, [secondsRemaining]);

  return {
    secondsRemaining,
    formatted,
    isExpired: secondsRemaining !== null && secondsRemaining <= 0,
    isActive,
  };
}

function computeRemainingSeconds(targetTime: string | null | undefined, fallback: number | null): number | null {
  if (targetTime) {
    const targetDate = new Date(targetTime);
    if (!Number.isNaN(targetDate.getTime())) {
      const diff = targetDate.getTime() - Date.now();
      return Math.floor(diff / 1000);
    }
  }

  if (fallback !== null && fallback !== undefined) {
    return fallback;
  }

  return null;
}

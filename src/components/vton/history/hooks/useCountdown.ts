import { useState, useEffect } from "react";

interface CountdownState {
  remainingMs: number;
  remainingLabel: string;
  severity: "neutral" | "warning" | "danger";
  isExpired: boolean;
  nextTickMs: number;
}

const useCountdown = (expiresAt?: string | null): CountdownState => {
  const [countdown, setCountdown] = useState<CountdownState>({
    remainingMs: 0,
    remainingLabel: "N/A",
    severity: "neutral",
    isExpired: false,
    nextTickMs: 0,
  });

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const calculateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const remainingMs = expires - now;

      const isExpired = remainingMs <= 0;

      let remainingLabel = "Wygasło";
      let severity: "neutral" | "warning" | "danger" = "neutral";
      let nextTickMs = 1000; // Update every second

      if (!isExpired) {
        const remainingSeconds = Math.floor((remainingMs / 1000) % 60);
        const remainingMinutes = Math.floor((remainingMs / (1000 * 60)) % 60);
        const remainingHours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);

        remainingLabel = `${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;

        if (remainingMs < 24 * 60 * 60 * 1000) {
          severity = "warning";
        }

        if (remainingMs < 60 * 60 * 1000) {
          severity = "danger";
          nextTickMs = remainingMs % 1000; // Update more frequently as it approaches expiration
        }
      }

      setCountdown({
        remainingMs,
        remainingLabel,
        severity,
        isExpired,
        nextTickMs,
      });
    };

    calculateCountdown(); // Initial calculation

    const intervalId = setInterval(calculateCountdown, countdown.nextTickMs);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [expiresAt, countdown.nextTickMs]);

  return countdown;
};

export default useCountdown;
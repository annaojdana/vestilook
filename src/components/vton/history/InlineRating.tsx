import { useCallback, useId, type KeyboardEvent } from "react";
import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface InlineRatingProps {
  value: number | null;
  onRate: (rating: number) => void;
  disabled: boolean;
  isSubmitting: boolean;
  ariaLabel?: string;
}

const RATING_SCALE = [1, 2, 3, 4, 5] as const;

const InlineRating: React.FC<InlineRatingProps> = ({
  value,
  onRate,
  disabled,
  isSubmitting,
  ariaLabel = "Oceń wygenerowany wynik",
}) => {
  const descriptionId = useId();
  const statusId = useId();
  const isBusy = disabled || isSubmitting;
  const fallbackFocusValue = value ?? 3;

  const requestRatingChange = useCallback(
    (next: number) => {
      if (isBusy || next === value) {
        return;
      }
      onRate(next);
    },
    [isBusy, onRate, value]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isBusy) {
        return;
      }

      const { key } = event;
      if (key === "ArrowRight" || key === "ArrowUp") {
        event.preventDefault();
        const next = Math.min(5, (value ?? fallbackFocusValue) + 1);
        requestRatingChange(next);
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowDown") {
        event.preventDefault();
        const next = Math.max(1, (value ?? fallbackFocusValue) - 1);
        requestRatingChange(next);
        return;
      }
      if (key === "Home") {
        event.preventDefault();
        requestRatingChange(1);
        return;
      }
      if (key === "End") {
        event.preventDefault();
        requestRatingChange(5);
      }
    },
    [fallbackFocusValue, isBusy, requestRatingChange, value]
  );

  const tabIndexFor = useCallback(
    (rating: number) => {
      if (isBusy) {
        return -1;
      }

      const focusValue = value ?? fallbackFocusValue;
      return rating === focusValue ? 0 : -1;
    },
    [fallbackFocusValue, isBusy, value]
  );

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        aria-disabled={isBusy}
        aria-live="off"
        className="flex flex-wrap items-center gap-2"
        onKeyDown={handleKeyDown}
      >
        {RATING_SCALE.map((rating) => {
          const selected = value === rating;
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={tabIndexFor(rating)}
              onClick={() => requestRatingChange(rating)}
              disabled={isBusy}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-background text-muted-foreground hover:border-primary/60 hover:text-primary"
              )}
            >
              <StarIcon className={cn("size-4", selected ? "fill-current" : "stroke-2")} aria-hidden="true" />
              <span className="sr-only">{`${rating} ${rating === 1 ? "gwiazdka" : "gwiazdki"}`}</span>
            </button>
          );
        })}
      </div>
      <p id={descriptionId} className="text-xs text-muted-foreground/80">
        1 — słaba zgodność, 5 — najwyższa jakość dopasowania.
      </p>
      <p id={statusId} aria-live="polite" className="sr-only">
        {isSubmitting ? "Zapisywanie oceny..." : value ? `Aktualna ocena: ${value} z 5.` : "Brak wystawionej oceny."}
      </p>
    </div>
  );
};

export default InlineRating;

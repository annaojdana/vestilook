import { FilterIcon, RotateCcwIcon } from "lucide-react";
import { useId, type FC, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { GenerationHistoryFilters, GenerationStatus } from "../../../types";

interface FilterToolbarProps {
  value: GenerationHistoryFilters;
  onChange: (value: GenerationHistoryFilters) => void;
  onSubmit: () => void;
  isPending: boolean;
}

const STATUS_OPTIONS: Array<{ value: GenerationStatus; label: string; description: string }> = [
  { value: "queued", label: "Oczekujące", description: "W kolejce Vertex" },
  { value: "processing", label: "Przetwarzane", description: "Model generuje wynik" },
  { value: "succeeded", label: "Ukończone", description: "Dostępne do podglądu/pobrania" },
  { value: "failed", label: "Niepowodzenie", description: "Wymaga ponowienia" },
  { value: "expired", label: "Wygasłe", description: "Zasób usunięty po TTL" },
];

const LIMIT_OPTIONS = [20, 50, 100];

const FilterToolbar: FC<FilterToolbarProps> = ({ value, onChange, onSubmit, isPending }) => {
  const formId = useId();

  const toggleStatus = (status: GenerationStatus) => {
    const current = new Set(value.status);
    if (current.has(status)) {
      current.delete(status);
    } else {
      current.add(status);
    }
    onChange({
      ...value,
      status: Array.from(current),
    });
  };

  const handleDateChange = (field: "from" | "to", iso: string) => {
    onChange({
      ...value,
      [field]: iso || undefined,
    });
  };

  const handleLimitChange = (next: number) => {
    onChange({
      ...value,
      limit: next,
    });
  };

  const handleReset = () => {
    onChange({
      ...value,
      status: [],
      from: undefined,
      to: undefined,
      limit: LIMIT_OPTIONS[0],
    });
    onSubmit();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const hasActiveFilters =
    value.status.length > 0 || Boolean(value.from) || Boolean(value.to) || value.limit !== LIMIT_OPTIONS[0];

  const fromDate = value.from?.slice(0, 10) ?? "";
  const toDate = value.to?.slice(0, 10) ?? "";

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-[0_20px_45px_-30px_rgb(15_23_42/0.7)]"
      aria-busy={isPending}
      aria-label="Filtry historii"
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground/70">
        <FilterIcon className="size-4" aria-hidden="true" />
        Filtry historii
      </div>

      <fieldset className="mb-4 flex flex-col gap-3" aria-label="Status generacji">
        <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
          Status
        </legend>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => {
            const active = value.status.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleStatus(option.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-10 flex-1 items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-none sm:min-w-[11rem]",
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs text-muted-foreground/80">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
          Od
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => handleDateChange("from", event.target.value)}
            className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-base font-normal text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
          Do
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => handleDateChange("to", event.target.value)}
            className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-base font-normal text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
          Limit wyników
          <select
            value={value.limit}
            onChange={(event) => handleLimitChange(Number(event.target.value))}
            className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-base font-medium text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>
                {limit} wpisów
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground" aria-live="polite">
          {hasActiveFilters ? "Filtry aktywne – zastosuj, aby odświeżyć listę." : "Brak aktywnych filtrów."}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="ghost" onClick={handleReset} disabled={isPending || !hasActiveFilters}>
            <RotateCcwIcon className="mr-2 size-4" aria-hidden="true" />
            Wyczyść
          </Button>
          <Button type="submit" disabled={isPending}>
            Zastosuj filtry
          </Button>
        </div>
      </div>
    </form>
  );
};

export default FilterToolbar;

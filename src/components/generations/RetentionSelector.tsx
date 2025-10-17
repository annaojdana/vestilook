import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { RetentionOption } from "./types.ts";

export interface RetentionSelectorProps {
  value: number;
  options: RetentionOption[];
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function RetentionSelector({ value, options, disabled, onChange }: RetentionSelectorProps) {
  return (
    <section className="space-y-3 rounded-xl border border-muted-foreground/20 bg-background p-5">
      <header>
        <h2 className="text-lg font-semibold text-foreground">Retencja wygenerowanych stylizacji</h2>
        <p className="text-sm text-muted-foreground">
          Wybierz, jak długo przechowywać wyniki generacji. Po upływie wybranego czasu stylizacja zostanie trwale
          usunięta z pamięci Vestilook.
        </p>
      </header>

      <RadioGroup value={String(value)} onValueChange={(next) => onChange(Number.parseInt(next, 10))} className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={`retention-${option.value}`}
            className="flex cursor-pointer flex-col gap-2 rounded-lg border border-muted-foreground/20 bg-muted/10 p-4 text-left transition hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60"
            data-disabled={disabled}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem
                id={`retention-${option.value}`}
                value={String(option.value)}
                aria-label={`Przechowuj przez ${option.value} godzin`}
                className="size-5"
                disabled={disabled}
              />
              <span className="text-base font-medium text-foreground">{option.label}</span>
            </div>
            {option.description ? <p className="text-xs text-muted-foreground">{option.description}</p> : null}
          </label>
        ))}
      </RadioGroup>
    </section>
  );
}

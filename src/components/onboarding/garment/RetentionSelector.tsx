import { Clock3 } from "lucide-react";
import type { FC } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface RetentionSelectorProps {
  value: number;
  options: number[];
  onChange: (value: number) => void;
}

const RetentionSelector: FC<RetentionSelectorProps> = ({ value, options, onChange }) => {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Clock3 className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Retencja wyników</p>
          <h2 className="text-lg font-semibold text-foreground">Jak długo przechowywać stylizację?</h2>
          <p className="text-sm text-muted-foreground">
            Wybierz, jak długo chcesz mieć dostęp do renderów. Dłuższa retencja szybciej zużywa darmowe zasoby.
          </p>
        </div>
      </div>

      <RadioGroup
        value={String(value)}
        onValueChange={(val) => {
          const parsed = Number.parseInt(val, 10);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
        className="grid gap-3 md:grid-cols-3"
      >
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 rounded-2xl border border-border/70 bg-muted/30 p-4 transition hover:border-primary/50",
              value === option ? "border-primary/70 bg-primary/5" : ""
            )}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value={String(option)} id={`retain-${option}`} />
              <Label htmlFor={`retain-${option}`} className="text-sm font-semibold text-foreground">
                {option} h
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {option <= 24
                ? "Szybkie renderowanie, automatyczne czyszczenie po 24h."
                : option >= 72
                  ? "Najdłuższy dostęp — idealny, gdy potrzebujesz więcej czasu."
                  : "Balans pomiędzy czasem a wykorzystaniem zasobów."}
            </p>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
};

export default RetentionSelector;

import { CheckCircle2, InfoIcon } from "lucide-react";
import type { FC } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImageValidationConstraints } from "@/types.ts";

interface GarmentPreparationChecklistProps {
  constraints: ImageValidationConstraints;
  className?: string;
}

const DEFAULT_STEPS = [
  {
    title: "Zadbaj o ekspozycję",
    description: "Umieść ubranie na wieszaku lub manekinie, aby materiał był w pełni widoczny.",
  },
  {
    title: "Neutralne tło",
    description: "Użyj jednolitego, dobrze oświetlonego tła — unikaj wzorów i cieni.",
  },
  {
    title: "Wysoka rozdzielczość",
    description: "Zrób zdjęcie w pionie lub poziomie w rozdzielczości min. 1024×1024 px.",
  },
  {
    title: "Zapis w PNG/JPEG",
    description: "Wyeksportuj obraz w formacie PNG lub JPEG bez kompresji destrukcyjnej.",
  },
];

const GarmentPreparationChecklist: FC<GarmentPreparationChecklistProps> = ({ constraints, className }) => {
  const maxSizeMb = (constraints.maxBytes / (1024 * 1024)).toFixed(1);

  return (
    <Card
      className={cn(
        "flex flex-col gap-5 border border-dashed border-primary/30 bg-background/70 p-6 shadow-sm backdrop-blur",
        className
      )}
    >
      <header className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <InfoIcon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/70">Brief jakości</p>
          <h2 className="text-xl font-semibold text-foreground">Przygotuj zdjęcie ubrania</h2>
          <p className="text-sm text-muted-foreground">
            Poniższe kroki pomagają systemowi Vertex AI odwzorować strukturę materiału i uniknąć artefaktów.
          </p>
        </div>
      </header>

      <ol className="space-y-4" aria-label="Lista kroków przygotowania zdjęcia ubrania">
        {DEFAULT_STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 flex-none text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {index + 1}. {step.title}
              </p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <dl className="grid gap-4 rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm text-foreground sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-muted-foreground">Minimalna rozdzielczość</dt>
          <dd>
            {constraints.minWidth} × {constraints.minHeight} px
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Maksymalny rozmiar pliku</dt>
          <dd>{maxSizeMb} MB</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Dozwolone formaty</dt>
          <dd>{constraints.allowedMimeTypes.join(", ")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Przechowywanie wyników</dt>
          <dd>Domyślnie 48h — możesz wybrać 24–72h w kolejnym kroku</dd>
        </div>
      </dl>
    </Card>
  );
};

export default GarmentPreparationChecklist;

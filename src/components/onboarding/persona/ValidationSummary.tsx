import { Fragment, type FC } from "react";

import { cn } from "@/lib/utils";

import type { PersonaValidationError } from "@/types.ts";

interface ValidationSummaryProps {
  errors: PersonaValidationError[];
  id?: string;
  className?: string;
}

const ValidationSummary: FC<ValidationSummaryProps> = ({ errors, id, className }) => {
  if (!errors || errors.length === 0) {
    return (
      <div id={id} className="sr-only" aria-live="polite">
        Brak błędów walidacji.
      </div>
    );
  }

  const { palette, title } = resolvePalette(errors);

  return (
    <section
      id={id}
      role="alert"
      aria-live="assertive"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm shadow-sm",
        palette.container,
        palette.text,
        className
      )}
    >
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 list-outside list-disc space-y-1 pl-5 text-xs leading-relaxed">
        {errors.map((error, index) => (
          <Fragment key={`${error.code}-${index}`}>
            <li>{error.message}</li>
            {error.hint ? <p className="ml-5 text-muted-foreground/80">{error.hint}</p> : null}
          </Fragment>
        ))}
      </ul>
    </section>
  );
};

export default ValidationSummary;

function resolvePalette(errors: PersonaValidationError[]) {
  const hasOnlyWarnings = errors.every((error) => error.severity === "warning");

  if (hasOnlyWarnings) {
    return {
      palette: {
        container: "border-amber-500/40 bg-amber-50/80",
        text: "text-amber-900",
      },
      title: "Uwaga: sprawdź przesyłany plik",
    };
  }

  return {
    palette: {
      container: "border-destructive/40 bg-destructive/10",
      text: "text-destructive",
    },
    title: "Nie udało się zweryfikować pliku",
  };
}

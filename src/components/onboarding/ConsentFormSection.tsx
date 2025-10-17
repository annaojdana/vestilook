import { useId, type FC, type FormEvent, type RefObject } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { ConsentErrorState, ConsentViewModel } from "./consent-types.ts";
import { InlineFeedbackRegion } from "./InlineFeedbackRegion.tsx";
import PrimaryActionBar from "./PrimaryActionBar.tsx";

interface ConsentFormSectionProps {
  viewModel: ConsentViewModel;
  checked: boolean;
  disabled: boolean;
  isSubmitting: boolean;
  showValidationError: boolean;
  error: ConsentErrorState | null;
  feedbackId: string;
  descriptionId: string;
  feedbackRef: RefObject<HTMLDivElement>;
  onCheckedChange(value: boolean): void;
  onSubmit(): void;
  onRetry(): void;
}

const ConsentFormSection: FC<ConsentFormSectionProps> = ({
  viewModel,
  checked,
  disabled,
  isSubmitting,
  showValidationError,
  error,
  feedbackId,
  descriptionId,
  feedbackRef,
  onCheckedChange,
  onSubmit,
  onRetry,
}) => {
  const checkboxId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const showUpdateNotice =
    Boolean(viewModel.acceptedVersion) && viewModel.acceptedVersion !== viewModel.requiredVersion;

  const ariaDescribedBy = cn(descriptionId, feedbackId);

  return (
    <form
      className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/80 shadow-inner"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4 p-6">
        <fieldset className="space-y-3" aria-describedby={ariaDescribedBy} aria-invalid={showValidationError}>
          <legend className="text-base font-semibold text-foreground">Akceptacja zgody</legend>
          <p id={descriptionId} className="text-sm text-muted-foreground">
            Aby kontynuować korzystanie z Vestilook, zaakceptuj aktualną politykę przetwarzania wizerunku.
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-transparent p-2 focus-within:border-primary focus-within:bg-primary/5">
            <Checkbox
              id={checkboxId}
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(value === true)}
              disabled={disabled}
              aria-describedby={ariaDescribedBy}
              aria-invalid={showValidationError}
            />
            <Label htmlFor={checkboxId} className="text-sm leading-relaxed text-foreground">
              Akceptuję{" "}
              <a
                href={viewModel.policyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                politykę przetwarzania wizerunku Vestilook
              </a>{" "}
              i wyrażam zgodę na wykorzystanie mojego wizerunku w celu realizacji wirtualnych przymiarek.
            </Label>
          </div>
          {showUpdateNotice ? (
            <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span>Twoja poprzednia zgoda dotyczyła wersji {viewModel.acceptedVersion}.</span>{" "}
              <span>Prosimy o potwierdzenie nowej wersji {viewModel.requiredVersion}, aby kontynuować.</span>
            </div>
          ) : null}
        </fieldset>
        <InlineFeedbackRegion
          id={feedbackId}
          ref={feedbackRef}
          error={resolveDisplayedError(error, showValidationError)}
        />
      </div>
      <PrimaryActionBar
        primary={{ label: "Akceptuję", onClick: onSubmit }}
        secondary={{ label: "Odśwież", onClick: onRetry }}
        disabled={disabled || !checked}
        loading={isSubmitting}
        meta={
          <div className="flex flex-col gap-1 text-left">
            <span>
              Po akceptacji przejdziesz do kolejnego kroku: <strong>/onboarding/persona</strong>
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              Ostatnia modyfikacja:{" "}
              {viewModel.metadata?.updatedAt ? formatDate(viewModel.metadata.updatedAt) : "nieznana"}
            </span>
          </div>
        }
      />
    </form>
  );
};

function resolveDisplayedError(error: ConsentErrorState | null, showValidationError: boolean) {
  if (!error) {
    return null;
  }

  if (error.code === "validation" && !showValidationError) {
    return null;
  }

  return error;
}

function formatDate(date: string): string {
  const parsed = Number.isNaN(Date.parse(date)) ? null : new Date(date);
  if (!parsed) {
    return "nieznana";
  }

  return parsed.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default ConsentFormSection;

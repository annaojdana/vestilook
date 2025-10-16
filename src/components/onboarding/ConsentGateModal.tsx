import { useEffect, useId, useRef, type FC } from "react";

import type { ConsentErrorState, ConsentFormState, ConsentViewModel } from "./consent-types.ts";
import ConsentFormSection from "./ConsentFormSection.tsx";
import PolicyContent from "./PolicyContent.tsx";

type CheckboxChangeHandler = (value: boolean) => void;

interface ConsentGateModalProps {
  viewModel: ConsentViewModel;
  formState: ConsentFormState;
  isSubmitting: boolean;
  isActionDisabled: boolean;
  error: ConsentErrorState | null;
  onCheckboxChange: CheckboxChangeHandler;
  onSubmit(): void;
  onRetry(): void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, details, [tabindex]:not([tabindex="-1"])';

const ConsentGateModal: FC<ConsentGateModalProps> = ({
  viewModel,
  formState,
  isSubmitting,
  isActionDisabled,
  error,
  onCheckboxChange,
  onSubmit,
  onRetry,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const policyHeadingId = useId();
  const policyDescriptionId = useId();
  const formDescriptionId = useId();
  const feedbackId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
        const ariaHidden = el.getAttribute("aria-hidden");
        return !el.hasAttribute("disabled") && el.tabIndex !== -1 && ariaHidden !== "true";
      });

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !node.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [viewModel.requiredVersion]);

  return (
    <section
      ref={dialogRef}
      aria-labelledby="consent-modal-heading"
      role="dialog"
      aria-modal="true"
      className="flex w-full flex-1 flex-col gap-8 rounded-3xl border border-border/70 bg-card/90 p-8 text-left shadow-2xl backdrop-blur-xl"
    >
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground/80">Vestilook</p>
        <h1
          ref={headingRef}
          id="consent-modal-heading"
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-4"
        >
          Zgoda na przetwarzanie wizerunku
        </h1>
        <p className="text-xs text-muted-foreground">
          Wymagana wersja: <span className="font-semibold text-foreground">{viewModel.requiredVersion}</span>
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.15fr)]">
        <PolicyContent headingId={policyHeadingId} descriptionId={policyDescriptionId} viewModel={viewModel} />
        <ConsentFormSection
          viewModel={viewModel}
          checked={formState.isCheckboxChecked}
          disabled={isActionDisabled}
          isSubmitting={isSubmitting}
          showValidationError={formState.showValidationError}
          error={error}
          feedbackId={feedbackId}
          descriptionId={formDescriptionId}
          onCheckedChange={onCheckboxChange}
          onSubmit={onSubmit}
          onRetry={onRetry}
        />
      </div>
    </section>
  );
};

export default ConsentGateModal;

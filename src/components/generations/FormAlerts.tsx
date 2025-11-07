import { AlertCircle, Ban, ShieldAlert, Sparkles, TimerReset } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { GarmentValidationError, GenerationErrorState, GenerationFormState } from "./types.ts";

export interface FormAlertsProps {
  status: GenerationFormState["status"];
  formError: GenerationErrorState | null;
  garmentError: GarmentValidationError | null;
  quotaLocked: boolean;
  consentOutdated: boolean;
}

export function FormAlerts({ status, formError, garmentError, quotaLocked, consentOutdated }: FormAlertsProps) {
  const retryAfterSeconds = formError?.retryAfterSeconds;
  const success = status === "success";

  if (!formError && !garmentError && !quotaLocked && !consentOutdated && !success) {
    return null;
  }

  return (
    <div className="space-y-3" data-testid="generation-form-alerts">
      {success ? (
        <Alert variant="success" className="pl-12" data-testid="generation-success-alert">
          <Sparkles className="size-5" aria-hidden="true" />
          <AlertTitle>Stylizacja została rozpoczęta</AlertTitle>
          <AlertDescription className="text-sm">
            Kolejka Google Vertex AI przetwarza Twoją stylizację. Możesz śledzić postęp w historii generacji.
          </AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive" className="pl-12" data-testid="generation-error-alert">
          <AlertCircle className="size-5" aria-hidden="true" />
          <AlertTitle>Nie udało się uruchomić generacji</AlertTitle>
          <AlertDescription className="text-sm">
            {formError.message}
            {retryAfterSeconds ? (
              <span className="block pt-1 text-xs text-muted-foreground">
                Spróbuj ponownie za około {formatRetryAfter(retryAfterSeconds)}.
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {garmentError ? (
        <Alert variant="warning" className="pl-12" data-testid="garment-validation-alert">
          <Ban className="size-5" aria-hidden="true" />
          <AlertTitle>Błąd walidacji pliku</AlertTitle>
          <AlertDescription className="text-sm">{garmentError.message}</AlertDescription>
        </Alert>
      ) : null}

      {quotaLocked ? (
        <Alert variant="destructive" className="pl-12" data-testid="quota-locked-alert">
          <TimerReset className="size-5" aria-hidden="true" />
          <AlertTitle>Limit generacji został wyczerpany</AlertTitle>
          <AlertDescription className="text-sm">
            Odczekaj do odnowienia puli lub skontaktuj się z opiekunem, aby zwiększyć limit dostępnych stylizacji.
          </AlertDescription>
        </Alert>
      ) : null}

      {consentOutdated ? (
        <Alert variant="warning" className="pl-12" data-testid="consent-outdated-alert">
          <ShieldAlert className="size-5" aria-hidden="true" />
          <AlertTitle>Zaktualizuj zgodę przed wysyłką</AlertTitle>
          <AlertDescription className="text-sm">
            Zaznacz checkbox zgody, aby zapisać nową wersję polityki. Bez tego generacja nie zostanie uruchomiona.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function formatRetryAfter(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "kilka sekund";
  }

  if (seconds < 60) {
    return `${Math.ceil(seconds)} sekund`;
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minutę" : minutes >= 2 && minutes <= 4 ? "minuty" : "minut"}`;
}

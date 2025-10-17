import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { ConsentFormState } from "./types.ts";

export interface ConsentReaffirmationProps {
  state: ConsentFormState;
  onToggle: (checked: boolean) => void;
  policyUrl: string;
  disabled?: boolean;
}

export function ConsentReaffirmation({ state, onToggle, policyUrl, disabled }: ConsentReaffirmationProps) {
  const consentOutdated = !state.isCompliant || state.acceptedVersion !== state.currentVersion;

  return (
    <section className="space-y-4 rounded-xl border border-muted-foreground/20 bg-muted/10 p-5">
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Zgoda na przetwarzanie wizerunku</h2>
        <p className="text-sm text-muted-foreground">
          Wirtualne przymiarki powstają z wykorzystaniem Google Vertex AI. Aby kontynuować, potwierdź obowiązującą
          zgodę na przetwarzanie swojego wizerunku.
        </p>
      </header>

      <div className="flex items-start gap-3">
        <Checkbox
          id="generation-consent"
          checked={state.checkboxChecked}
          onCheckedChange={(checked) => onToggle(Boolean(checked))}
          disabled={disabled}
          aria-describedby="generation-consent-hint"
        />
        <div className="space-y-1">
          <Label htmlFor="generation-consent" className="text-sm font-medium text-foreground">
            Akceptuję aktualną politykę przetwarzania wizerunku
          </Label>
          <p id="generation-consent-hint" className="text-xs text-muted-foreground">
            Zapoznaj się z{" "}
            <a className="text-primary underline underline-offset-2 hover:text-primary/90" href={policyUrl} target="_blank" rel="noreferrer">
              warunkami przetwarzania
            </a>{" "}
            przed uruchomieniem generacji.
          </p>
        </div>
      </div>

      {consentOutdated ? (
        <Alert variant="warning" className="pl-12">
          <ShieldAlert className="size-5" aria-hidden="true" />
          <AlertTitle>Wymagana ponowna akceptacja</AlertTitle>
          <AlertDescription className="text-sm">
            Wersja zgody zmieniła się na <strong>{state.currentVersion}</strong>. Zaznaczenie pola spowoduje zapis aktualnej akceptacji przed wysłaniem formularza.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="success" className="pl-12">
          <ShieldCheck className="size-5" aria-hidden="true" />
          <AlertTitle>Zgoda aktualna</AlertTitle>
          <AlertDescription className="text-sm">
            Ostatnio zaakceptowana wersja: <strong>{state.acceptedVersion ?? "brak danych"}</strong>. Możesz kontynuować generowanie stylizacji.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

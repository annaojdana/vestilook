import { useId, type FC } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { ConsentRequestError } from "./useConsentRequirement.ts";
import type { ConsentRequirement } from "@/types.ts";

interface ConsentDialogProps {
  open: boolean;
  consent: ConsentRequirement;
  busy: boolean;
  error: ConsentRequestError | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

const ConsentDialog: FC<ConsentDialogProps> = ({ open, consent, busy, error, onConfirm, onDismiss }) => {
  const errorRegionId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onDismiss();
        }
      }}
    >
      <DialogContent className="max-w-xl space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-primary" />
            Aktualizacja zgody na wizerunek
          </DialogTitle>
          <DialogDescription>
            Aby uruchomić wirtualne przymiarki, potwierdź aktualną wersję polityki przetwarzania wizerunku Vestilook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Po akceptacji zapisujemy identyfikator zgody na Twoim profilu i będziemy mogli bezpiecznie przetwarzać
            przesłane zdjęcia podczas generowania stylizacji.
          </p>

          <dl className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-muted/40 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Wersja wymagana
              </dt>
              <dd className="text-base font-semibold text-foreground">{consent.requiredVersion ?? "nieznana"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Aktualna zgoda
              </dt>
              <dd className="text-base text-foreground">
                {consent.acceptedVersion ? consent.acceptedVersion : <span className="italic">brak</span>}
              </dd>
            </div>
          </dl>

          <ul className="list-disc space-y-1 pl-5">
            <li>Twoje zdjęcie persony służy wyłącznie do generowania stylizacji w Vestilook.</li>
            <li>Pliki są przechowywane maksymalnie 72 godziny, zgodnie z naszą polityką bezpieczeństwa.</li>
            <li>W każdej chwili możesz wycofać zgodę w ustawieniach profilu.</li>
          </ul>
        </div>

        <div
          id={errorRegionId}
          role={error ? "alert" : undefined}
          aria-live="assertive"
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            error ? "border-destructive/40 bg-destructive/10 text-destructive" : "hidden"
          )}
        >
          {error?.message}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onDismiss} disabled={busy}>
            Anuluj
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {busy ? "Zapisywanie..." : "Akceptuję"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentDialog;

import { Clock, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { QuotaViewModel } from "./types.ts";

export interface QuotaIndicatorProps {
  quota: QuotaViewModel;
}

export function QuotaIndicator({ quota }: QuotaIndicatorProps) {
  const locked = quota.hardLimitReached || quota.remaining <= 0;
  const renewsAtLabel = quota.renewsAt ? new Date(quota.renewsAt).toLocaleString() : null;

  return (
    <section className="rounded-xl border border-muted-foreground/20 bg-muted/10 p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Limit generacji</h2>
          <p className="text-lg font-bold text-foreground">
            {quota.remaining} / {quota.total} darmowych stylizacji
          </p>
        </div>
        <Badge variant={locked ? "destructive" : "secondary"} className="px-3 py-1 text-xs">
          {locked ? "Limit wyczerpany" : "Dostępne generacje"}
        </Badge>
      </header>

      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Każda nowa stylizacja wykorzystuje jedno miejsce z puli darmowych generacji.
        </p>
        {renewsAtLabel ? (
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            Odnowienie limitu: <span className="font-medium text-foreground">{renewsAtLabel}</span>
          </p>
        ) : null}
      </div>

      {locked ? (
        <Alert variant="destructive" className="mt-4 pl-12">
          <AlertTitle>Brak dostępnych generacji</AlertTitle>
          <AlertDescription className="text-sm">
            Wykorzystałeś cały darmowy limit. Odczekaj do odnowienia puli lub skontaktuj się z zespołem Vestilook w
            sprawie zwiększenia limitu.
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

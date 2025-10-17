import type { FC } from "react";
import { AlertTriangleIcon, ShieldCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ConsentRequestError } from "./useConsentRequirement.ts";
import type { ConsentRequirement } from "@/types.ts";

interface ConsentStatusBannerProps {
  consent: ConsentRequirement;
  loading: boolean;
  error: ConsentRequestError | null;
  onRequestConsent: () => void;
  onShowDetails?: () => void;
}

const ConsentStatusBanner: FC<ConsentStatusBannerProps> = ({
  consent,
  loading,
  error,
  onRequestConsent,
  onShowDetails,
}) => {
  const acceptedVersionLabel = consent.acceptedVersion ? `Obecnie: ${consent.acceptedVersion}` : "Brak aktywnej zgody";

  return (
    <section
      role="status"
      className="relative overflow-hidden rounded-2xl border border-amber-500/50 bg-amber-50/80 p-4 text-amber-900 shadow-[0_12px_45px_-25px_rgb(245_158_11/0.55)]"
      aria-live="polite"
    >
      <div className="absolute inset-y-0 right-0 hidden w-40 bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.12),_transparent_75%)] lg:block" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-2 ring-amber-500/40"
          >
            <AlertTriangleIcon className="size-5" />
          </div>
          <div className="space-y-2">
            <header className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600/90">
                Wymagana akcja
              </p>
              <h2 className="text-lg font-semibold text-amber-900">
                Zaktualizuj zgodę na przetwarzanie wizerunku
              </h2>
            </header>
            <p className="text-sm leading-relaxed text-amber-900/80">
              Aby kontynuować przesyłanie persony bazowej, zaakceptuj najnowszą wersję polityki wizerunkowej
              Vestilook. To jednorazowy krok wymagany przez Vertex AI przed uruchomieniem wirtualnych przymiarek.
            </p>

            <dl className="flex flex-wrap gap-3 text-xs text-amber-900/80">
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 shadow-sm ring-1 ring-amber-500/30">
                <ShieldCheckIcon className="size-3.5" />
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Wersja wymagana:</span>
                  <Badge variant="secondary" className="border-amber-500/40 bg-white text-xs font-semibold text-amber-800">
                    {consent.requiredVersion ?? "nieznana"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 shadow-sm ring-1 ring-amber-500/30">
                <span className="font-medium">{acceptedVersionLabel}</span>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto">
          <Button
            type="button"
            onClick={onRequestConsent}
            disabled={loading}
            aria-busy={loading}
            className="w-full md:w-auto"
          >
            {loading ? "Zapisywanie..." : "Akceptuj zgodę"}
          </Button>
          {onShowDetails ? (
            <Button
              type="button"
              variant="outline"
              onClick={onShowDetails}
              disabled={loading}
              className={cn("w-full border-amber-500/40 text-amber-800 hover:bg-amber-100 md:w-auto")}
            >
              Zobacz szczegóły
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-amber-500/30 bg-white/70 px-3 py-2 text-xs text-amber-900">
          {error.message}
        </p>
      ) : null}
    </section>
  );
};

export default ConsentStatusBanner;

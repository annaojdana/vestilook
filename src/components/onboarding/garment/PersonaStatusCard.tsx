import { AlertTriangle, RefreshCw } from "lucide-react";
import type { FC } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProfileResponseDto } from "@/types.ts";

interface PersonaStatusCardProps {
  persona: ProfileResponseDto["persona"];
  previewUrl?: string | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const PersonaStatusCard: FC<PersonaStatusCardProps> = ({ persona, previewUrl, loading, error, onRefresh }) => {
  const personaReady = Boolean(persona?.path);
  const updatedAtLabel = persona?.updatedAt ? new Date(persona.updatedAt).toLocaleString() : null;

  return (
    <Card className="flex flex-col gap-4 border border-border/70 bg-background/80 p-5 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Krok 2 zakończony</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">Twoja persona bazowa</h2>
          <Badge variant={personaReady ? "default" : "secondary"} className="rounded-full px-3 py-1 text-xs">
            {personaReady ? "Gotowa" : "Brak"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Persona jest przechowywana w prywatnym zasobniku Supabase i będzie używana przy każdej stylizacji.
        </p>
      </header>

      <figure className="overflow-hidden rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30">
        {personaReady && previewUrl ? (
          <img
            src={previewUrl}
            alt="Podgląd przesłanej persony"
            className="h-64 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Brak podglądu persony. Możesz go odświeżyć za chwilę.
          </div>
        )}
      </figure>

      <dl className="grid gap-4 text-sm text-foreground sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-muted-foreground">Ścieżka w magazynie</dt>
          <dd className="truncate font-mono text-xs text-muted-foreground">
            {persona?.path ?? "nie dotyczy"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Ostatnia aktualizacja</dt>
          <dd>{updatedAtLabel ?? "—"}</dd>
        </div>
      </dl>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Nie udało się odświeżyć</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          {loading ? "Odświeżanie..." : "Odśwież dane persony"}
        </Button>
      </div>
    </Card>
  );
};

export default PersonaStatusCard;

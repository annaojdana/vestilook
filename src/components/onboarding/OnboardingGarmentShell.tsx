import { AlertTriangle, ArrowRight, LifeBuoy, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FC } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ImageValidationConstraints, ProfileResponseDto } from "@/types.ts";
import { supabaseClient } from "@/db/supabase.client.ts";
import { getSignedAssetUrl } from "@/lib/vton/assets.ts";
import { cn } from "@/lib/utils";

import GarmentPreparationChecklist from "./garment/GarmentPreparationChecklist.tsx";
import PersonaStatusCard from "./garment/PersonaStatusCard.tsx";
import RetentionSelector from "./garment/RetentionSelector.tsx";

interface OnboardingGarmentShellProps {
  profile: ProfileResponseDto;
  constraints: ImageValidationConstraints;
  personaBucket: string;
  retainOptions: number[];
  defaultRetention: number;
  nextPath: string;
}

interface ProfileState {
  profile: ProfileResponseDto;
  loading: boolean;
  error: string | null;
}

const OnboardingGarmentShell: FC<OnboardingGarmentShellProps> = ({
  profile,
  constraints,
  personaBucket,
  retainOptions,
  defaultRetention,
  nextPath,
}) => {
  const [profileState, setProfileState] = useState<ProfileState>({ profile, loading: false, error: null });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedRetention, setSelectedRetention] = useState(() => sanitizeRetention(defaultRetention, retainOptions));
  const [personaError, setPersonaError] = useState<string | null>(null);

  const personaReady = Boolean(profileState.profile.persona);

  const sortedRetainOptions = useMemo(() => {
    return Array.from(new Set(retainOptions)).filter(isFinite).sort((a, b) => a - b);
  }, [retainOptions]);

  useEffect(() => {
    let active = true;

    if (!profileState.profile.persona?.path) {
      setPreviewUrl(null);
      return;
    }

    void getSignedAssetUrl(personaBucket, profileState.profile.persona.path, {
      expiresIn: 120,
      cacheTtlMs: 60_000,
    })
      .then((url) => {
        if (!active) {
          return;
        }

        setPreviewUrl(url);
        setPersonaError(null);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setPreviewUrl(null);
        setPersonaError("Nie udało się pobrać podglądu persony. Spróbuj ponownie później.");
      });

    return () => {
      active = false;
    };
  }, [personaBucket, profileState.profile.persona?.path]);

  const handleUnauthorized = useCallback(() => {
    void supabaseClient.auth.signOut();
    window.location.replace("/auth/login");
  }, []);

  const handleRefresh = useCallback(async () => {
    setProfileState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        handleUnauthorized();
        return;
      }

      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("profile_refresh_failed");
      }

      const payload = (await response.json()) as ProfileResponseDto;
      setProfileState({ profile: payload, loading: false, error: null });
    } catch (error) {
      console.error("[onboarding/garment] Failed to refresh profile.", error);
      setProfileState((prev) => ({
        ...prev,
        loading: false,
        error: "Nie udało się odświeżyć danych profilu. Spróbuj ponownie.",
      }));
    }
  }, [handleUnauthorized]);

  const handleContinue = useCallback(() => {
    if (!personaReady) {
      return;
    }

    const targetRetention = sanitizeRetention(selectedRetention, sortedRetainOptions) ?? defaultRetention;

    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(nextPath, window.location.origin);
    nextUrl.searchParams.set("retain", String(targetRetention));
    window.location.assign(nextUrl.toString());
  }, [defaultRetention, nextPath, personaReady, selectedRetention, sortedRetainOptions]);

  const disabledReason = !personaReady
    ? "Dodaj lub odśwież personę, aby kontynuować."
    : profileState.loading
      ? "Czekamy na odświeżenie danych…"
      : null;

  return (
    <div className="flex w-full flex-col gap-8 rounded-[32px] border border-border/80 bg-gradient-to-b from-background/90 via-card to-card/80 p-8 shadow-2xl backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">Krok 3 z 3</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Przygotuj zdjęcie ubrania</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          To ostatni krok przed uruchomieniem pierwszej stylizacji. Zobacz podsumowanie przesłanej persony, zapoznaj się z
          checklistą jakości i wybierz, jak długo chcesz przechowywać wyniki w chmurze.
        </p>
      </header>

      {personaError ? (
        <Alert variant="warning" className="border-dashed border-amber-500/60 bg-amber-50/40 text-amber-900">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Problemy z podglądem persony</AlertTitle>
          <AlertDescription>{personaError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PersonaStatusCard
          persona={profileState.profile.persona}
          previewUrl={previewUrl}
          loading={profileState.loading}
          error={profileState.error}
          onRefresh={handleRefresh}
        />
        <GarmentPreparationChecklist constraints={constraints} />
      </section>

      <RetentionSelector
        value={selectedRetention}
        options={sortedRetainOptions}
        onChange={(value) => setSelectedRetention(sanitizeRetention(value, sortedRetainOptions))}
      />

      <footer
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/80 p-5 shadow-[0_-12px_35px_-28px_rgb(15_23_42/0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="text-xs text-muted-foreground">
          <p>
            {disabledReason ??
              `Wyniki będą dostępne przez ${selectedRetention}h, po czym zostaną automatycznie usunięte z magazynu.`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="mailto:support@vestilook.com"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <LifeBuoy className="size-4" aria-hidden="true" />
            Potrzebujesz wsparcia?
          </a>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!personaReady || profileState.loading}
            className="min-h-11 min-w-[11rem]"
          >
            Rozpocznij stylizację
            <ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Button>
        </div>
      </footer>

      {!personaReady ? (
        <Alert variant="destructive" className="border-dashed border-destructive/40 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Brakuje persony</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-sm text-destructive/90">
            <span>Aby przejść dalej, wróć do poprzedniego kroku i prześlij zdjęcie bazowe.</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => window.location.assign("/onboarding/persona")}
            >
              <RefreshCcw className="mr-2 size-4" aria-hidden="true" />
              Wróć do przesyłania persony
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};

function sanitizeRetention(requested: number, available: number[]): number {
  if (!Number.isFinite(requested)) {
    return available[0] ?? 48;
  }

  if (!available.includes(requested)) {
    return available[0] ?? requested;
  }

  return requested;
}

export default OnboardingGarmentShell;

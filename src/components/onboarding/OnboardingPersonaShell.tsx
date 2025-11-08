import { useCallback, useEffect, useRef, useState, type FC } from "react";

import { Toaster } from "@/components/ui/sonner.tsx";
import { supabaseClient } from "@/db/supabase.client.ts";
import {
  PERSONA_UPLOAD_CONSTRAINTS,
  type PersonaUploaderStatus,
  type PersonaUploadResponseDto,
  type PersonaValidationError,
  type ProfileResponseDto,
} from "@/types.ts";

import ConsentDialog from "./persona/ConsentDialog.tsx";
import ConsentStatusBanner from "./persona/ConsentStatusBanner.tsx";
import ActionFooter from "./persona/ActionFooter.tsx";
import { PersonaUploadProvider } from "./persona/PersonaUploadContext.tsx";
import UploadGuidelines from "./persona/UploadGuidelines.tsx";
import PersonaUploader from "./persona/PersonaUploader.tsx";
import ProgressToast from "./persona/ProgressToast.tsx";
import { useConsentRequirement } from "./persona/useConsentRequirement.ts";
import { usePersonaProfile } from "./persona/usePersonaProfile.ts";
import { usePersonaUploader } from "./persona/usePersonaUploader.ts";
import { useToastQueue } from "./persona/useToastQueue.ts";

type RetryIntent = "upload" | null;

interface OnboardingPersonaShellProps {
  profile: ProfileResponseDto | null;
  initialAccessToken: string | null;
  nextPath: string;
}

const OnboardingPersonaShell: FC<OnboardingPersonaShellProps> = ({
  profile,
  initialAccessToken: _initialAccessToken,
  nextPath,
}) => {
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [retryIntent, setRetryIntent] = useState<RetryIntent>(null);

  const personaProfile = usePersonaProfile(profile);
  const { viewModel, applyConsentReceipt, applyUploadResponse, applyConsentRequirement } = personaProfile;
  const { present, update, dismiss } = useToastQueue();

  const lastUploaderStatusRef = useRef<PersonaUploaderStatus>("idle");
  const progressToastIdRef = useRef<string | null>(null);
  const uploadPersonaRef = useRef<() => Promise<PersonaUploadResponseDto | null> | null>(null);

  const handleUnauthorized = useCallback(() => {
    void supabaseClient.auth.signOut();
    window.location.replace("/auth/login");
  }, []);

  const consentHarness = useConsentRequirement(viewModel.consent, {
    onResolved: (receipt) => {
      applyConsentReceipt(receipt);
      present({
        title: "Dziękujemy! Zgoda została zapisana.",
        variant: "success",
        durationMs: 3200,
      });
      setConsentDialogOpen(false);

      setRetryIntent((intent) => {
        if (intent === "upload") {
          const retry = uploadPersonaRef.current;
          if (retry) {
            void retry();
          }
        }
        return null;
      });
    },
  });

  const handleConsentRequired = useCallback(() => {
    setConsentDialogOpen(true);
    setRetryIntent("upload");
    present({
      title: "Zaktualizuj zgodę, aby kontynuować przesyłanie persony.",
      variant: "info",
      durationMs: 4200,
    });
  }, [present]);

  const handleServerError = useCallback(
    (status: number) => {
      setRetryIntent("upload");
      present({
        title: status >= 500 ? "Wewnętrzny błąd serwera. Spróbuj ponownie później." : "Operacja nie powiodła się.",
        variant: "error",
        action: {
          label: "Spróbuj ponownie",
          onSelect: () => {
            setRetryIntent(null);
            const retry = uploadPersonaRef.current;
            if (retry) {
              void retry();
            }
          },
        },
      });
    },
    [present]
  );

  const uploader = usePersonaUploader({
    constraints: PERSONA_UPLOAD_CONSTRAINTS,
    consent: consentHarness.consent,
    onProgress: (progress) => {
      const title =
        progress.percentage >= 100
          ? "Finalizujemy przesyłanie persony..."
          : `Przesyłanie persony: ${progress.percentage}%`;

      if (progressToastIdRef.current) {
        update(progressToastIdRef.current, {
          title,
          variant: "progress",
          dismissible: false,
        });
      } else {
        progressToastIdRef.current = present({
          title,
          variant: "progress",
          dismissible: false,
          durationMs: null,
        });
      }
    },
    onUnauthorized: handleUnauthorized,
    onConsentRequired: handleConsentRequired,
    onSuccess: (response) => {
      applyUploadResponse(response);
      present({
        title: "Persona została pomyślnie przesłana.",
        variant: "success",
        durationMs: 3200,
      });
      setRetryIntent(null);
    },
    onServerError: handleServerError,
  });
  uploadPersonaRef.current = uploader.upload;

  useEffect(() => {
    applyConsentRequirement(consentHarness.consent);
  }, [applyConsentRequirement, consentHarness.consent]);

  useEffect(() => {
    if (consentHarness.error?.code === "unauthorized") {
      handleUnauthorized();
    }
  }, [consentHarness.error?.code, handleUnauthorized]);

  useEffect(() => {
    const status = uploader.state.status;
    const previousStatus = lastUploaderStatusRef.current;

    if (status !== "uploading" && progressToastIdRef.current) {
      dismiss(progressToastIdRef.current);
      progressToastIdRef.current = null;
    }

    if (status === "success" && previousStatus !== "success") {
      // Success toast handled in onSuccess callback.
      lastUploaderStatusRef.current = status;
      return;
    }

    if (status === "error" && previousStatus !== "error") {
      const [firstError] = uploader.state.validationErrors;
      if (firstError?.code === "consent_required") {
        lastUploaderStatusRef.current = status;
        return;
      }

      const message = resolveValidationMessage(uploader.state.validationErrors);
      if (message) {
        const variant = firstError?.code === "network_error" ? "warning" : "error";
        setRetryIntent("upload");
        present({
          title: message,
          variant,
          action: {
            label: "Spróbuj ponownie",
            onSelect: () => {
              setRetryIntent(null);
              const retry = uploadPersonaRef.current;
              if (retry) {
                void retry();
              }
            },
          },
        });
      }
    }

    lastUploaderStatusRef.current = status;
  }, [dismiss, present, uploader.state.status, uploader.state.validationErrors]);

  const handleRequestConsent = useCallback(() => {
    setConsentDialogOpen(true);
  }, []);

  const handleConsentConfirm = useCallback(() => {
    void consentHarness.requestConsent();
  }, [consentHarness]);

  const handleConsentDismiss = useCallback(() => {
    setConsentDialogOpen(false);
    consentHarness.resetError();
    setRetryIntent(null);
  }, [consentHarness]);

  const handleContinue = useCallback(() => {
    window.location.assign(nextPath);
  }, [nextPath]);

  const shouldShowConsentBanner = !consentHarness.consent.isCompliant;

  return (
    <PersonaUploadProvider
      constraints={PERSONA_UPLOAD_CONSTRAINTS}
      consent={consentHarness.consent}
      uploader={uploader}
    >
      <div className="flex w-full flex-col gap-8 rounded-3xl border border-border/70 bg-card/90 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary/80">Krok 2 z 3</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Dodaj swoją personę bazową
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Prześlij zdjęcie referencyjne w wysokiej rozdzielczości, aby Google Vertex AI mógł odwzorować Twój wizerunek
            podczas wirtualnego przymierzania. Użyj zdjęcia na jednolitym tle, z wyraźną sylwetką.
          </p>
        </header>

        {shouldShowConsentBanner ? (
          <ConsentStatusBanner
            consent={consentHarness.consent}
            loading={consentHarness.loading}
            error={consentHarness.error}
            onRequestConsent={handleRequestConsent}
            onShowDetails={handleRequestConsent}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PersonaUploader />
          <UploadGuidelines constraints={PERSONA_UPLOAD_CONSTRAINTS} />
        </section>

        <ActionFooter
          disabled={!viewModel.canContinue || uploader.busy}
          onContinue={handleContinue}
          supportLink="mailto:support@vestilook.com"
          supportLabel="Potrzebujesz pomocy?"
        />
      </div>

      <ConsentDialog
        open={consentDialogOpen}
        consent={consentHarness.consent}
        busy={consentHarness.loading}
        error={consentHarness.error}
        onConfirm={handleConsentConfirm}
        onDismiss={handleConsentDismiss}
      />

      <ProgressToast progress={uploader.state.progress} status={uploader.state.status} />

      <Toaster richColors closeButton position="top-right" expand />
    </PersonaUploadProvider>
  );
};

function resolveValidationMessage(errors: PersonaValidationError[]): string | null {
  if (!errors || errors.length === 0) {
    return null;
  }

  const firstError = errors[0];
  if (!firstError || firstError.severity === "warning") {
    return null;
  }

  return firstError.message;
}

export default OnboardingPersonaShell;

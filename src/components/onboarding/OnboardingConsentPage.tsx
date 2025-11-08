import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/db/supabase.client.ts";

import ConsentGateModal from "./ConsentGateModal.tsx";
import type { ConsentErrorState, ConsentFormState, ConsentViewModel } from "./consent-types.ts";
import { ConsentApiError } from "./consent-types.ts";
import { useAcceptConsentMutation } from "./useAcceptConsentMutation.ts";
import { useConsentStatusQuery } from "./useConsentStatusQuery.ts";
import { useConsentRedirect } from "./useConsentRedirect.ts";

interface OnboardingConsentPageProps {
  policyUrl: string;
  nextPath?: string;
}

const DEFAULT_NEXT_PATH = "/onboarding/persona";

const OnboardingConsentPage: FC<OnboardingConsentPageProps> = ({ policyUrl, nextPath = DEFAULT_NEXT_PATH }) => {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: false,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConsentPageContent policyUrl={policyUrl} nextPath={nextPath} />
    </QueryClientProvider>
  );
};

interface ConsentPageContentProps {
  policyUrl: string;
  nextPath: string;
}

const ConsentPageContent: FC<ConsentPageContentProps> = ({ policyUrl, nextPath }) => {
  const focusContainerRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const loginRedirectTriggeredRef = useRef(false);
  const [errorState, setErrorState] = useState<ConsentErrorState | null>(null);
  const [formState, setFormState] = useState<ConsentFormState>({
    isCheckboxChecked: false,
    showValidationError: false,
  });

  const { data, error: queryError, isPending, isRefetching, refetch, status: queryStatus } = useConsentStatusQuery();

  const viewModel = useMemo<ConsentViewModel | null>(() => {
    if (!data) {
      return null;
    }

    const resolvedPolicyUrl = data.policyUrl && data.policyUrl !== "#" ? data.policyUrl : policyUrl;

    if (resolvedPolicyUrl === data.policyUrl) {
      return data;
    }

    return {
      ...data,
      policyUrl: resolvedPolicyUrl,
    };
  }, [data, policyUrl]);

  const handleUnauthorized = useCallback(() => {
    if (loginRedirectTriggeredRef.current) {
      return;
    }

    loginRedirectTriggeredRef.current = true;
    void supabaseClient.auth.signOut();
    window.location.replace("/auth/login");
  }, []);

  const {
    triggerRedirect: triggerNextStepRedirect,
    resetRedirect,
    isRedirecting,
  } = useConsentRedirect({
    viewModel,
    nextPath,
  });

  const mutation = useAcceptConsentMutation({
    onError: (mutationError) => {
      if (mutationError.code === "unauthorized") {
        handleUnauthorized();
        return;
      }

      if (mutationError.code === "conflict") {
        void refetch();
      }

      presentErrorFeedback(mutationError);
      setErrorState(mapApiErrorToState(mutationError));
    },
    onSuccess: () => {
      setErrorState(null);
      toast.success("Dziękujemy! Zgoda została zapisana.");
      triggerNextStepRedirect();
    },
  });

  useEffect(() => {
    if (!queryError) {
      if (queryStatus === "success") {
        setErrorState(null);
      }
      return;
    }

    if (queryError.code === "unauthorized") {
      handleUnauthorized();
      return;
    }

    presentErrorFeedback(queryError);
    setErrorState(mapApiErrorToState(queryError));
  }, [handleUnauthorized, queryError, queryStatus]);

  const requiredVersion = viewModel?.requiredVersion;

  useEffect(() => {
    if (!requiredVersion) {
      return;
    }

    setFormState({
      isCheckboxChecked: false,
      showValidationError: false,
    });
  }, [requiredVersion]);

  useEffect(() => {
    if (isPending || !viewModel) {
      return;
    }

    const focusTarget = focusContainerRef.current;
    focusTarget?.focus();
  }, [isPending, viewModel]);

  useEffect(() => {
    if (!errorState) {
      return;
    }

    feedbackRef.current?.focus();
  }, [errorState]);

  const handleRetry = useCallback(() => {
    setErrorState(null);
    resetRedirect();
    setFormState({
      isCheckboxChecked: false,
      showValidationError: false,
    });
    toast.info("Ponawiamy próbę pobrania treści zgody.");
    void refetch();
  }, [refetch, resetRedirect]);

  const handleCheckboxChange = useCallback(
    (value: boolean) => {
      setFormState((prev) => ({
        isCheckboxChecked: value,
        showValidationError: value ? false : prev.showValidationError,
      }));

      if (value && errorState?.code === "validation") {
        setErrorState(null);
      }
    },
    [errorState?.code]
  );

  const handleSubmit = useCallback(() => {
    if (!viewModel || mutation.isPending || isRefetching) {
      return;
    }

    if (!formState.isCheckboxChecked) {
      setFormState((prev) => ({ ...prev, showValidationError: true }));
      const validationError = createValidationErrorState();
      setErrorState(validationError);
      presentErrorFeedback(validationError);
      return;
    }

    if (errorState?.code === "validation") {
      setErrorState(null);
    }

    mutation.mutate({ version: viewModel.requiredVersion });
  }, [errorState?.code, formState.isCheckboxChecked, isRefetching, mutation, viewModel]);

  const isLoading = isPending || isRefetching || mutation.isPending || isRedirecting;
  const isActionDisabled = mutation.isPending || isRefetching || isRedirecting;

  if (isPending && !viewModel) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <ConsentPageSkeleton />
      </div>
    );
  }

  if (!isPending && !viewModel) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <ConsentPageErrorFallback onRetry={handleRetry} message={errorState?.message} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <div
        ref={focusContainerRef}
        tabIndex={-1}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <ConsentGateModal
          viewModel={viewModel}
          formState={formState}
          isSubmitting={mutation.isPending || isRefetching}
          isActionDisabled={isActionDisabled}
          error={errorState}
          feedbackRef={feedbackRef}
          onCheckboxChange={handleCheckboxChange}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
        />
      </div>
      {isLoading ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Trwa synchronizacja danych zgody. Prosimy o chwilę cierpliwości.
        </p>
      ) : null}
    </div>
  );
};

interface ConsentPageErrorFallbackProps {
  message?: string;
  onRetry(): void;
}

const ConsentPageErrorFallback: FC<ConsentPageErrorFallbackProps> = ({ message, onRetry }) => {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-center shadow-lg">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-destructive">Nie udało się pobrać treści zgody</h2>
        <p className="text-sm text-destructive/80">
          {message ?? "Spróbuj ponownie za chwilę lub sprawdź połączenie z internetem."}
        </p>
      </div>
      <Button onClick={onRetry} variant="outline">
        Spróbuj ponownie
      </Button>
    </div>
  );
};

const ConsentPageSkeleton: FC = () => {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-border/60 bg-card/60 p-10 shadow-xl backdrop-blur">
      <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
      <div className="space-y-3">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-lg bg-muted/80" />
        <div className="h-4 w-5/6 animate-pulse rounded-lg bg-muted/70" />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-4 animate-pulse rounded-lg bg-muted/80" />
        <div className="h-4 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-4 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-4 animate-pulse rounded-lg bg-muted/50" />
      </div>
      <div className="mt-auto flex justify-end gap-3">
        <div className="h-10 w-28 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
};

function mapApiErrorToState(error: ConsentApiError): ConsentErrorState {
  switch (error.code) {
    case "bad_request":
      return {
        code: "bad_request",
        message: "Wersja zgody nie jest obsługiwana. Odśwież widok i spróbuj ponownie.",
        details: error.details,
      };
    case "conflict":
      return {
        code: "conflict",
        message: "Pojawiła się nowa wersja zgody. Ładujemy zaktualizowaną treść.",
        details: error.details,
      };
    case "server_error":
      return {
        code: "server_error",
        message: "Wystąpił błąd po stronie serwera. Spróbuj ponownie później.",
        details: error.details,
      };
    case "network":
      return {
        code: "network",
        message: "Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem.",
        details: error.details,
      };
    case "validation":
      return {
        code: "validation",
        message: "Zaznacz wymagane zgody, aby kontynuować.",
        details: error.details,
      };
    case "unauthorized":
    default:
      return {
        code: "unauthorized",
        message: "Twoja sesja wygasła. Zaloguj się ponownie.",
        details: error.details,
      };
  }
}

function presentErrorFeedback(error: ConsentApiError | ConsentErrorState) {
  switch (error.code) {
    case "network":
      toast.error("Problem z połączeniem sieciowym. Sprawdź internet i spróbuj ponownie.");
      break;
    case "server_error":
      toast.error("Serwer Vestilook ma chwilowe trudności. Spróbuj ponownie za moment.");
      break;
    case "bad_request":
      toast.warning("Przesłane dane zgody są nieaktualne. Odśwież widok, aby pobrać aktualną treść.");
      break;
    case "conflict":
      toast.info("Pojawiła się nowa wersja zgody. Odświeżamy widok.");
      break;
    case "unauthorized":
      toast.info("Twoja sesja wygasła. Przekierowujemy do logowania.");
      break;
    case "validation":
      break;
    default:
      toast.error("Nieznany błąd. Spróbuj ponownie później.");
  }
}

function createValidationErrorState(): ConsentErrorState {
  return {
    code: "validation",
    message: "Zaznacz wymagane zgody, aby kontynuować.",
  };
}

export default OnboardingConsentPage;

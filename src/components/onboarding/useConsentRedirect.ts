import { useCallback, useEffect, useRef, useState } from "react";

import type { ConsentViewModel } from "./consent-types.ts";

interface UseConsentRedirectOptions {
  viewModel: ConsentViewModel | null;
  nextPath: string;
}

interface UseConsentRedirectResult {
  triggerRedirect(): void;
  resetRedirect(): void;
  isRedirecting: boolean;
}

export function useConsentRedirect({ viewModel, nextPath }: UseConsentRedirectOptions): UseConsentRedirectResult {
  const redirectTriggeredRef = useRef(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const triggerRedirect = useCallback(() => {
    if (redirectTriggeredRef.current) {
      return;
    }

    redirectTriggeredRef.current = true;
    setIsRedirecting(true);
    window.location.assign(nextPath);
  }, [nextPath]);

  const resetRedirect = useCallback(() => {
    redirectTriggeredRef.current = false;
    setIsRedirecting(false);
  }, []);

  useEffect(() => {
    if (!viewModel) {
      return;
    }

    const isCompliant =
      viewModel.isCompliant &&
      Boolean(viewModel.acceptedVersion) &&
      viewModel.acceptedVersion === viewModel.requiredVersion;

    if (isCompliant) {
      triggerRedirect();
    }
  }, [triggerRedirect, viewModel?.acceptedVersion, viewModel?.isCompliant, viewModel?.requiredVersion, viewModel]);

  return { triggerRedirect, resetRedirect, isRedirecting };
}

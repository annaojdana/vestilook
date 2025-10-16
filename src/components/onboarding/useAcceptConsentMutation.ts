import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";

import { submitConsentAcceptance } from "./consent-api.ts";
import type { ConsentApiError, ConsentSubmissionResult } from "./consent-types.ts";
import { consentQueryKeys } from "./consent-query-keys.ts";

export interface AcceptConsentVariables {
  version: string;
}

export function useAcceptConsentMutation(
  options?: UseMutationOptions<ConsentSubmissionResult, ConsentApiError, AcceptConsentVariables>
) {
  const queryClient = useQueryClient();

  return useMutation<ConsentSubmissionResult, ConsentApiError, AcceptConsentVariables>({
    mutationKey: [...consentQueryKeys.consentStatus(), "accept"],
    mutationFn: ({ version }) => submitConsentAcceptance({ version, accepted: true }),
    ...options,
    onSuccess: async (data, variables, context) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: consentQueryKeys.consentStatus() }),
        queryClient.invalidateQueries({ queryKey: consentQueryKeys.profileRoot() }),
      ]);

      await options?.onSuccess?.(data, variables, context);
    },
  });
}

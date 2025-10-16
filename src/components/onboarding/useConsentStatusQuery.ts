import { useQuery } from "@tanstack/react-query";

import { fetchConsentStatus } from "./consent-api.ts";
import type { ConsentApiError, ConsentViewModel } from "./consent-types.ts";
import { consentQueryKeys } from "./consent-query-keys.ts";

export function useConsentStatusQuery() {
  return useQuery<ConsentViewModel, ConsentApiError>({
    queryKey: consentQueryKeys.consentStatus(),
    queryFn: ({ signal }) => fetchConsentStatus({ signal }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

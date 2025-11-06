import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAcceptConsentMutation, type AcceptConsentVariables } from "@/components/onboarding/useAcceptConsentMutation.ts";
import { consentQueryKeys } from "@/components/onboarding/consent-query-keys.ts";
import type { ConsentSubmissionResult } from "@/components/onboarding/consent-types.ts";

vi.mock("@/components/onboarding/consent-api.ts", () => ({
  submitConsentAcceptance: vi.fn(),
}));

const { submitConsentAcceptance } = await import("@/components/onboarding/consent-api.ts");
const submitConsentAcceptanceMock = vi.mocked(submitConsentAcceptance);

function createWrapper() {
  const queryClient = new QueryClient();
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockImplementation((options) => {
    return originalInvalidate(options);
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient, invalidateSpy };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAcceptConsentMutation", () => {
  it("submits consent acceptance and invalidates relevant queries", async () => {
    const resultDto: ConsentSubmissionResult = {
      acceptedVersion: "v2",
      acceptedAt: "2024-05-01T10:00:00.000Z",
      status: "updated",
    };

    submitConsentAcceptanceMock.mockResolvedValueOnce(resultDto);

    const { Wrapper, invalidateSpy, queryClient } = createWrapper();
    const { result } = renderHook(() => useAcceptConsentMutation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ version: "v2" });
    });

    expect(submitConsentAcceptanceMock).toHaveBeenCalledWith({ version: "v2", accepted: true });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: consentQueryKeys.consentStatus() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: consentQueryKeys.profileRoot() });
    queryClient.clear();
  });

  it("calls provided onSuccess handler after invalidations", async () => {
    const resultDto: ConsentSubmissionResult = {
      acceptedVersion: "v3",
      acceptedAt: "2024-05-02T12:00:00.000Z",
      status: "created",
    };

    submitConsentAcceptanceMock.mockResolvedValueOnce(resultDto);
    const onSuccess = vi.fn();

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(
      () =>
        useAcceptConsentMutation({
          onSuccess,
        }),
      { wrapper: Wrapper },
    );

    const variables: AcceptConsentVariables = { version: "v3" };

    await act(async () => {
      await result.current.mutateAsync(variables);
    });

    expect(onSuccess).toHaveBeenCalledWith(resultDto, variables, undefined);
    queryClient.clear();
  });
});

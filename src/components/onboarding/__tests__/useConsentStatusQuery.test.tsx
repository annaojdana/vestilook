import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/db/supabase.client.ts", () => {
  const getSession = vi.fn();
  return {
    supabaseClient: {
      auth: {
        getSession,
      },
    },
  };
});

import { supabaseClient } from "@/db/supabase.client.ts";

import { server } from "../../../../tests/setup.ts";
import { useConsentStatusQuery } from "../useConsentStatusQuery.ts";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient };
}

describe("useConsentStatusQuery", () => {
  beforeEach(() => {
    vi.spyOn(supabaseClient.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "test-token",
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped consent view model on success", async () => {
    const mockResponse = {
      requiredVersion: "v2",
      acceptedVersion: "v1",
      acceptedAt: "2024-01-01T12:00:00.000Z",
      isCompliant: false,
      policyContent: "<p>Regulamin przetwarzania</p>",
      policyUrl: "https://vestilook.com/polityka",
      metadata: {
        updatedAt: "2024-05-10T08:30:00.000Z",
        source: "gcp",
      },
    };

    if (!server) {
      throw new Error("MSW server is not initialized");
    }

    server.use(
      http.get("/api/profile/consent", () => {
        return HttpResponse.json(mockResponse);
      })
    );

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useConsentStatusQuery(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      requiredVersion: "v2",
      acceptedVersion: "v1",
      policyUrl: "https://vestilook.com/polityka",
      metadata: { source: "gcp" },
    });

    queryClient.clear();
  });

  it("surfaces conflict errors when API returns 409", async () => {
    if (!server) {
      throw new Error("MSW server is not initialized");
    }

    server.use(
      http.get("/api/profile/consent", () => {
        return new HttpResponse(null, { status: 409 });
      })
    );

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useConsentStatusQuery(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error.code).toBe("conflict");

    queryClient.clear();
  });
});

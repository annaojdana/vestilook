// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

import { useGenerationStatus } from "@/components/vton/hooks/useGenerationStatus.ts";
import type {
  GenerationStatusViewModel,
  StatusMetadataViewModel,
} from "@/lib/vton/status.mapper.ts";
import type { GenerationDetailResponseDto } from "@/types.ts";

vi.mock("@/lib/vton/status.mapper.ts", () => ({
  buildGenerationStatusViewModel: vi.fn(),
  buildStatusMetadata: vi.fn(),
  isFinalStatus: vi.fn(),
}));

vi.mock("@/lib/vton/assets.ts", () => ({
  getSignedAssetUrl: vi.fn(),
}));

const { buildGenerationStatusViewModel, buildStatusMetadata, isFinalStatus } = await import(
  "@/lib/vton/status.mapper.ts"
);
const buildViewModelMock = vi.mocked(buildGenerationStatusViewModel);
const buildMetadataMock = vi.mocked(buildStatusMetadata);
const isFinalStatusMock = vi.mocked(isFinalStatus);

describe("useGenerationStatus", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    buildViewModelMock.mockReset();
    buildMetadataMock.mockReset();
    isFinalStatusMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns unauthorized error when server responds with 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const { result } = renderHook(() => useGenerationStatus("gen-unauthorized"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toMatchObject({
      code: "unauthorized",
      retriable: false,
      status: 401,
    });
    expect(result.current.isLoading).toBe(false);
    expect(buildViewModelMock).not.toHaveBeenCalled();
  });

  it("builds view model from detail payload and exposes refresh", async () => {
    const detail: GenerationDetailResponseDto = {
      id: "gen-123",
      status: "succeeded",
      personaSnapshotPath: "personas/path.png",
      clothSnapshotPath: "garments/path.png",
      resultPath: "results/path.png",
      vertexJobId: "vertex-123",
      errorReason: null,
      createdAt: "2024-04-10T10:00:00.000Z",
      startedAt: "2024-04-10T10:01:00.000Z",
      completedAt: "2024-04-10T10:02:00.000Z",
      ratedAt: null,
      expiresAt: "2024-04-12T10:00:00.000Z",
    };

    const viewModel: GenerationStatusViewModel = {
      id: detail.id,
      status: "succeeded",
      statusLabel: "Zakończono",
      statusDescription: "Wynik gotowy do pobrania.",
      createdAt: detail.createdAt,
      timeline: [],
      actions: {
        canViewResult: true,
        canDownload: true,
        canRetry: false,
        canRate: true,
        canKeepWorking: false,
      },
      personaPreviewUrl: undefined,
      garmentPreviewUrl: undefined,
      resultUrl: undefined,
      vertexJobId: detail.vertexJobId,
      errorCode: null,
      errorMessage: null,
      failureContext: null,
      etaSeconds: null,
      etaTarget: null,
      startedAt: detail.startedAt,
      completedAt: detail.completedAt,
      expiresAt: detail.expiresAt,
      quotaRemaining: null,
    };

    const metadata: StatusMetadataViewModel = {
      generationId: detail.id,
      createdAt: detail.createdAt,
      personaPath: detail.personaSnapshotPath,
      garmentPath: detail.clothSnapshotPath,
      startedAt: detail.startedAt,
      completedAt: detail.completedAt,
      expiresAt: detail.expiresAt,
      personaPreviewUrl: undefined,
      garmentPreviewUrl: undefined,
      vertexJobId: detail.vertexJobId,
      quotaRemaining: null,
    };

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(detail), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    buildViewModelMock.mockImplementation(() => viewModel);
    buildMetadataMock.mockImplementation(() => metadata);
    isFinalStatusMock.mockReturnValue(true);

    const { result } = renderHook(() => useGenerationStatus("gen-123"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe(viewModel);
    expect(result.current.metadata).toBe(metadata);
    expect(result.current.isFinal).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalled();

    // Trigger manual refresh
    const detailNext: GenerationDetailResponseDto = {
      ...detail,
      vertexJobId: "vertex-999",
    };
    const nextViewModel: GenerationStatusViewModel = {
      ...viewModel,
      vertexJobId: detailNext.vertexJobId,
    };
    const nextMetadata: StatusMetadataViewModel = {
      ...metadata,
      vertexJobId: detailNext.vertexJobId,
    };

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(detailNext), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    buildViewModelMock.mockImplementationOnce(() => nextViewModel);
    buildMetadataMock.mockImplementationOnce(() => nextMetadata);
    isFinalStatusMock.mockReturnValue(true);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.data).toBe(nextViewModel));
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

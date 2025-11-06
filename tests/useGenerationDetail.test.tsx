import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useGenerationDetail from "@/components/generations/hooks/useGenerationDetail.ts";
import type { GenerationDetailResponseDto } from "@/types.ts";

vi.mock("@/lib/vtonClient", () => ({
  getGenerationDetail: vi.fn(),
}));

const { getGenerationDetail } = await import("@/lib/vtonClient");
const getGenerationDetailMock = vi.mocked(getGenerationDetail);

describe("useGenerationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches generation detail and maps to view model", async () => {
    const payload: GenerationDetailResponseDto = {
      id: "gen-001",
      status: "succeeded",
      personaSnapshotPath: "persona/path.png",
      clothSnapshotPath: "cloth/path.png",
      resultPath: "result/path.png",
      vertexJobId: "vertex-123",
      errorReason: null,
      createdAt: "2024-03-10T12:00:00.000Z",
      startedAt: "2024-03-10T12:01:00.000Z",
      completedAt: "2024-03-10T12:02:00.000Z",
      ratedAt: null,
      expiresAt: "2024-03-12T12:00:00.000Z",
    };

    getGenerationDetailMock.mockResolvedValueOnce(payload);

    const { result } = renderHook(() => useGenerationDetail("gen-001"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({
      id: payload.id,
      status: payload.status,
    });
    expect(result.current.error).toBeNull();
    expect(getGenerationDetailMock).toHaveBeenCalledWith("gen-001");
  });

  it("stores error message when fetch fails", async () => {
    getGenerationDetailMock.mockRejectedValueOnce(new Error("Network unreachable"));

    const { result } = renderHook(() => useGenerationDetail("gen-error"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Network unreachable");
  });

  it("reloads detail when identifier changes", async () => {
    getGenerationDetailMock
      .mockResolvedValueOnce({
        id: "gen-1",
        status: "queued",
        personaSnapshotPath: null,
        clothSnapshotPath: null,
        resultPath: null,
        vertexJobId: null,
        errorReason: null,
        createdAt: "2024-03-11T10:00:00.000Z",
        startedAt: null,
        completedAt: null,
        ratedAt: null,
        expiresAt: "2024-03-12T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "gen-2",
        status: "processing",
        personaSnapshotPath: null,
        clothSnapshotPath: null,
        resultPath: null,
        vertexJobId: null,
        errorReason: null,
        createdAt: "2024-03-11T11:00:00.000Z",
        startedAt: null,
        completedAt: null,
        ratedAt: null,
        expiresAt: "2024-03-12T11:00:00.000Z",
      });

    const { result, rerender } = renderHook(({ id }) => useGenerationDetail(id), {
      initialProps: { id: "gen-1" },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.id).toBe("gen-1");

    await act(async () => {
      rerender({ id: "gen-2" });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.id).toBe("gen-2");
    expect(getGenerationDetailMock).toHaveBeenCalledWith("gen-1");
    expect(getGenerationDetailMock).toHaveBeenCalledWith("gen-2");
  });
});

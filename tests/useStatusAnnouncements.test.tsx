import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStatusAnnouncements } from "@/components/vton/hooks/useStatusAnnouncements.ts";
import type { GenerationStatusViewModel } from "@/lib/vton/status.mapper.ts";

const baseViewModel = {
  id: "gen-1",
  status: "processing",
  statusLabel: "Przetwarzanie",
  statusDescription: "Vertex AI pracuje nad stylizacją.",
  createdAt: "2024-05-01T10:00:00.000Z",
  timeline: [],
  actions: {
    canViewResult: false,
    canDownload: false,
    canRetry: false,
    canRate: false,
    canKeepWorking: false,
  },
} as GenerationStatusViewModel;

describe("useStatusAnnouncements", () => {
  it("produces assertive announcement when status becomes final", () => {
    const { result, rerender } = renderHook(
      ({ viewModel }) => useStatusAnnouncements(viewModel),
      { initialProps: { viewModel: null as GenerationStatusViewModel | null } },
    );

    const finalViewModel: GenerationStatusViewModel = {
      ...baseViewModel,
      status: "succeeded",
      statusLabel: "Zakończono",
      statusDescription: "Wynik jest gotowy do pobrania.",
    };

    act(() => {
      rerender({ viewModel: finalViewModel });
    });

    expect(result.current.announcement).toEqual({
      message: "Zakończono. Wynik jest gotowy do pobrania.",
      tone: "assertive",
    });
  });

  it("allows manual announcements and clearing", () => {
    const { result } = renderHook(() => useStatusAnnouncements(null));

    act(() => {
      result.current.announce("Testowa wiadomość");
    });
    expect(result.current.announcement).toEqual({
      message: "Testowa wiadomość",
      tone: "polite",
    });

    act(() => {
      result.current.clear();
    });
    expect(result.current.announcement).toBeNull();
  });

  it("ignores automatic updates when disabled", () => {
    const { result, rerender } = renderHook(
      ({ disabled }) => useStatusAnnouncements(baseViewModel, { disabled }),
      { initialProps: { disabled: true } },
    );

    act(() => {
      rerender({ disabled: false });
    });

    expect(result.current.announcement).toEqual({
      message: `${baseViewModel.statusLabel}. ${baseViewModel.statusDescription}`,
      tone: "polite",
    });
  });
});

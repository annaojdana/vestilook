import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { GenerationQueuedResponseDto } from "@/types.ts";
import type { GenerationStatusViewModel, StatusMetadataViewModel } from "@/lib/vton/status.mapper.ts";
import type { FailureHelpCTAProps } from "@/components/vton/FailureHelpCTA.tsx";
import { JobStatusPanel } from "@/components/vton/JobStatusPanel.tsx";

vi.mock("@/components/vton/hooks/useGenerationStatus.ts", () => ({
  useGenerationStatus: vi.fn(),
}));

vi.mock("@/components/vton/hooks/useEtaCountdown.ts", () => ({
  useEtaCountdown: vi.fn(),
}));

vi.mock("@/components/vton/hooks/useStatusAnnouncements.ts", () => ({
  useStatusAnnouncements: vi.fn(),
}));

let failureHelpProps: FailureHelpCTAProps | null = null;

vi.mock("@/components/vton/FailureHelpCTA.tsx", () => ({
  FailureHelpCTA: (props: FailureHelpCTAProps) => {
    failureHelpProps = props;
    return <div data-testid="failure-help-cta" />;
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { useGenerationStatus } = await import("@/components/vton/hooks/useGenerationStatus.ts");
const { useEtaCountdown } = await import("@/components/vton/hooks/useEtaCountdown.ts");
const { useStatusAnnouncements } = await import("@/components/vton/hooks/useStatusAnnouncements.ts");

const useGenerationStatusMock = vi.mocked(useGenerationStatus);
const useEtaCountdownMock = vi.mocked(useEtaCountdown);
const useStatusAnnouncementsMock = vi.mocked(useStatusAnnouncements);

const baseViewModel: GenerationStatusViewModel = {
  id: "gen-001",
  status: "processing",
  statusLabel: "Przetwarzanie",
  statusDescription: "Vertex AI pracuje nad stylizacją.",
  personaPreviewUrl: null,
  garmentPreviewUrl: null,
  resultUrl: null,
  vertexJobId: "vertex-job-123456",
  errorCode: null,
  errorMessage: null,
  failureContext: null,
  etaSeconds: 180,
  etaTarget: "2024-05-01T12:00:00.000Z",
  createdAt: "2024-05-01T11:57:00.000Z",
  startedAt: "2024-05-01T11:58:00.000Z",
  completedAt: null,
  expiresAt: "2024-05-02T11:57:00.000Z",
  timeline: [
    {
      key: "queued",
      label: "W kolejce",
      description: "Oczekiwanie na start",
      timestamp: "2024-05-01T11:57:00.000Z",
      isCurrent: false,
      isCompleted: true,
      tone: "info",
    },
    {
      key: "processing",
      label: "Przetwarzanie",
      description: "Vertex AI pracuje nad stylizacją.",
      timestamp: null,
      isCurrent: true,
      isCompleted: false,
      tone: "info",
    },
  ],
  actions: {
    canViewResult: true,
    canDownload: true,
    canRetry: true,
    canRate: false,
    canKeepWorking: true,
  },
  quotaRemaining: 3,
};

const baseMetadata: StatusMetadataViewModel = {
  generationId: "gen-001",
  createdAt: baseViewModel.createdAt,
  startedAt: baseViewModel.startedAt,
  completedAt: baseViewModel.completedAt,
  expiresAt: baseViewModel.expiresAt,
  personaPath: "gs://bucket/persona.png",
  garmentPath: "gs://bucket/garment.png",
  personaPreviewUrl: null,
  garmentPreviewUrl: null,
  vertexJobId: baseViewModel.vertexJobId,
  quotaRemaining: baseViewModel.quotaRemaining,
};

beforeEach(() => {
  vi.clearAllMocks();
  failureHelpProps = null;

  useEtaCountdownMock.mockReturnValue({
    formatted: "3m",
    secondsRemaining: 180,
    isExpired: false,
  });

  useStatusAnnouncementsMock.mockReturnValue({
    announcement: null,
    announce: vi.fn(),
    clear: vi.fn(),
  });
});

describe("JobStatusPanel", () => {
  it("renders job status header and metadata", () => {
    useGenerationStatusMock.mockReturnValue({
      data: baseViewModel,
      metadata: baseMetadata,
      error: null,
      isLoading: false,
      isPolling: false,
      isFinal: false,
      refresh: vi.fn(),
    });

    render(
      <JobStatusPanel
        open
        generationId="gen-001"
        onClose={vi.fn()}
        onNavigateToResult={vi.fn()}
      />,
    );

    const header = screen.getByRole("heading", { level: 2, name: "Przetwarzanie" });
    expect(header).toBeInTheDocument();

    const dialog = screen.getByTestId("dialog-content");
    expect(within(dialog).getAllByText("Vertex AI pracuje nad stylizacją.").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 3, name: /Szczegóły generacji/i })).toBeInTheDocument();
  });

  it("invokes navigate callback when primary action clicked", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    useGenerationStatusMock.mockReturnValue({
      data: baseViewModel,
      metadata: baseMetadata,
      error: null,
      isLoading: false,
      isPolling: false,
      isFinal: false,
      refresh: vi.fn(),
    });

    render(
      <JobStatusPanel
        open
        generationId="gen-001"
        onClose={onClose}
        onNavigateToResult={onNavigate}
      />,
    );

    const primaryActions = screen.getAllByRole("button", { name: /Zobacz wynik/i });
    expect(primaryActions.length).toBeGreaterThan(0);
    primaryActions.forEach((button) => {
      fireEvent.click(button);
    });

    expect(onNavigate).toHaveBeenCalledWith("gen-001");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error alert with retry when retriable error present", () => {
    const refresh = vi.fn();
    useGenerationStatusMock.mockReturnValue({
      data: null,
      metadata: null,
      error: {
        code: "network_error",
        message: "Nie udało się połączyć z serwerem.",
        retriable: true,
      },
      isLoading: false,
      isPolling: false,
      isFinal: false,
      refresh,
    });

    render(
      <JobStatusPanel
        open
        generationId="gen-001"
        onClose={vi.fn()}
        onNavigateToResult={vi.fn()}
      />,
    );

    expect(screen.getByText(/Problemy z połączeniem/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Odśwież teraz/i }));
    expect(refresh).toHaveBeenCalled();
  });

  it("propagates failure CTA actions to retry flow and closes panel for reupload intent", () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    const failureViewModel: GenerationStatusViewModel = {
      ...baseViewModel,
      status: "failed",
      statusLabel: "Niepowodzenie",
      failureContext: {
        title: "Generacja nie powiodła się",
        description: "Vertex AI zgłosił błąd.",
        actions: ["retry", "reupload-garment"],
        hint: null,
        supportUrl: null,
      },
      actions: {
        ...baseViewModel.actions,
        canRetry: true,
      },
    };

    useGenerationStatusMock.mockReturnValue({
      data: failureViewModel,
      metadata: baseMetadata,
      error: null,
      isLoading: false,
      isPolling: false,
      isFinal: false,
      refresh: vi.fn(),
    });

    render(
      <JobStatusPanel
        open
        generationId="gen-001"
        onClose={onClose}
        onNavigateToResult={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId("failure-help-cta")).toBeInTheDocument();
    expect(failureHelpProps?.context.title).toBe("Generacja nie powiodła się");

    failureHelpProps?.onAction?.("retry");
    expect(onRetry).toHaveBeenCalledWith("gen-001");

    failureHelpProps?.onAction?.("reupload-garment");
    expect(onClose).toHaveBeenCalled();
  });

  it("announces status updates with aria-live region", () => {
    useStatusAnnouncementsMock.mockReturnValueOnce({
      announcement: {
        message: "Proces zakończony pomyślnie.",
        tone: "assertive",
      },
      announce: vi.fn(),
      clear: vi.fn(),
    });

    useGenerationStatusMock.mockReturnValue({
      data: { ...baseViewModel, status: "succeeded", statusLabel: "Zakończono" },
      metadata: baseMetadata,
      error: null,
      isLoading: false,
      isPolling: false,
      isFinal: true,
      refresh: vi.fn(),
    });

    render(
      <JobStatusPanel
        open
        generationId="gen-001"
        onClose={vi.fn()}
        onNavigateToResult={vi.fn()}
      />,
    );

    const liveRegion = screen.getByText("Proces zakończony pomyślnie.");
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
  });

  it("notifies consumer about status changes", async () => {
    const onStatusChange = vi.fn();

    useGenerationStatusMock.mockReturnValue({
      data: baseViewModel,
      metadata: baseMetadata,
      error: null,
      isLoading: false,
      isPolling: false,
      isFinal: false,
      refresh: vi.fn(),
    });

    render(
      <JobStatusPanel
        open
        generationId="gen-001"
        onClose={vi.fn()}
        onNavigateToResult={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith(baseViewModel);
    });
  });
});

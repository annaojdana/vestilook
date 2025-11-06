import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobStatusFooter } from "@/components/vton/JobStatusFooter.tsx";
import type { GenerationStatusViewModel } from "@/lib/vton/status.mapper.ts";

const viewModel: GenerationStatusViewModel = {
  id: "gen-006",
  status: "succeeded",
  statusLabel: "Zakończono",
  statusDescription: "Wynik gotowy.",
  personaPreviewUrl: null,
  garmentPreviewUrl: null,
  resultUrl: "https://cdn.test/result.png",
  vertexJobId: "vertex-job-999",
  errorCode: null,
  errorMessage: null,
  failureContext: null,
  etaSeconds: null,
  etaTarget: null,
  createdAt: "2024-05-01T11:00:00.000Z",
  startedAt: "2024-05-01T11:01:00.000Z",
  completedAt: "2024-05-01T11:05:00.000Z",
  expiresAt: "2024-05-02T11:05:00.000Z",
  timeline: [],
  actions: {
    canViewResult: true,
    canDownload: false,
    canRetry: false,
    canRate: false,
    canKeepWorking: false,
  },
  quotaRemaining: 0,
};

describe("JobStatusFooter", () => {
  it("renders chips with metadata", () => {
    render(<JobStatusFooter viewModel={viewModel} onClose={vi.fn()} onAction={vi.fn()} />);

    expect(screen.getByText("Wygasa")).toBeInTheDocument();
    expect(screen.getByText("Darmowe generacje")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getAllByText("Zakończono").length).toBeGreaterThan(0);
  });

  it("invokes onClose and onAction when closing", () => {
    const onClose = vi.fn();
    const onAction = vi.fn();

    render(<JobStatusFooter viewModel={viewModel} onClose={onClose} onAction={onAction} />);

    const footers = screen.getAllByRole("contentinfo");
    const footer = footers[footers.length - 1];
    const closeButtons = within(footer).getAllByRole("button", { name: /^Zamknij$/i });

    closeButtons.forEach((button) => fireEvent.click(button));

    expect(onAction).toHaveBeenCalled();
    expect(onAction.mock.calls.some(([intent]) => intent === "close")).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobStatusHeader } from "@/components/vton/JobStatusHeader.tsx";
import type { EtaCountdownViewModel } from "@/lib/vton/status.mapper.ts";

vi.mock("@/components/ui/dialog.tsx", () => ({
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const eta: EtaCountdownViewModel = {
  targetTime: "2024-05-01T12:00:00.000Z",
  initialSeconds: 180,
  formattedRemaining: "3m",
  isExpired: false,
};

describe("JobStatusHeader", () => {
  it("renders status badge, label and description", () => {
    render(
      <JobStatusHeader
        status="processing"
        statusLabel="Przetwarzanie"
        statusDescription="Vertex AI pracuje nad stylizacją."
        eta={eta}
        onClose={vi.fn()}
        isLoading={true}
        vertexJobId="vertex-job-1234567890"
      />,
    );

    expect(screen.getByRole("heading", { name: "Przetwarzanie" })).toBeInTheDocument();
    expect(screen.getByText("Vertex AI pracuje nad stylizacją.")).toBeInTheDocument();
    expect(screen.getByText("3m")).toBeInTheDocument();
    expect(screen.getByText("Aktualizacja")).toBeInTheDocument();
  });

  it("triggers onClose when close button clicked", () => {
    const onClose = vi.fn();

    render(
      <JobStatusHeader
        status="succeeded"
        statusLabel="Generacja zakończona"
        statusDescription="Możesz pobrać wynik."
        eta={null}
        onClose={onClose}
        isLoading={false}
        vertexJobId={null}
      />,
    );

    const closeButton = screen.getAllByRole("button", { name: /Zamknij panel statusu/i }).pop();
    expect(closeButton).toBeDefined();
    fireEvent.click(closeButton!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

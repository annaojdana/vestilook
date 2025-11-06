import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatusMetadataSection } from "@/components/vton/StatusMetadataSection.tsx";
import type { StatusMetadataViewModel } from "@/lib/vton/status.mapper.ts";

const baseMetadata: StatusMetadataViewModel = {
  generationId: "gen-1234567890",
  createdAt: "2024-05-01T10:00:00.000Z",
  startedAt: "2024-05-01T10:01:00.000Z",
  completedAt: "2024-05-01T10:05:00.000Z",
  expiresAt: "2024-05-02T10:00:00.000Z",
  personaPath: "gs://bucket/persona.png",
  garmentPath: null,
  personaPreviewUrl: "https://cdn.test/persona.png",
  garmentPreviewUrl: null,
  vertexJobId: "vertex-job-001",
  quotaRemaining: 3,
};

describe("StatusMetadataSection", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
  });

  it("renders formatted metadata and asset previews", () => {
    render(<StatusMetadataSection metadata={baseMetadata} loading={false} />);

    expect(screen.getByText("Szczegóły generacji")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ID:/i })).toBeInTheDocument();
    expect(screen.getByText("Persona")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Otwórz podgląd Persona/i })).toHaveAttribute("href", baseMetadata.personaPreviewUrl!);
  });

  it("copies vertex job id to clipboard", async () => {
    render(<StatusMetadataSection metadata={baseMetadata} loading={false} />);

    const copyButtons = screen.getAllByRole("button", { name: /Kopiuj/i });
    fireEvent.click(copyButtons[copyButtons.length - 1]);

    expect(writeText.mock.calls.flat()).toContain(baseMetadata.vertexJobId);
  });

  it("renders fallback when metadata missing", () => {
    render(
      <StatusMetadataSection
        metadata={{
          generationId: "gen-empty",
          createdAt: "2024-05-01T10:00:00.000Z",
          startedAt: null,
          completedAt: null,
          expiresAt: null,
          personaPath: null,
          garmentPath: null,
          personaPreviewUrl: null,
          garmentPreviewUrl: null,
          vertexJobId: null,
          quotaRemaining: null,
        }}
      />,
    );

    expect(screen.getAllByText("Brak podpisanego zasobu").length).toBeGreaterThan(0);
  });
});

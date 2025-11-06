import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressTimeline } from "@/components/vton/ProgressTimeline.tsx";
import type { ProgressItem } from "@/lib/vton/status.mapper.ts";

const steps: ProgressItem[] = [
  {
    key: "queued",
    label: "W kolejce",
    description: "Oczekiwanie na uruchomienie zadania",
    timestamp: "2024-04-01T10:00:00.000Z",
    isCurrent: false,
    isCompleted: true,
    tone: "info",
  },
  {
    key: "processing",
    label: "Przetwarzanie",
    description: "Vertex AI nakłada stylizację",
    timestamp: null,
    isCurrent: true,
    isCompleted: false,
    tone: "info",
  },
  {
    key: "succeeded",
    label: "Zakończono",
    description: "Wyniki gotowe do pobrania",
    timestamp: null,
    isCurrent: false,
    isCompleted: false,
    tone: "success",
  },
];

describe("ProgressTimeline", () => {
  it("marks the current step with aria-current", () => {
    render(<ProgressTimeline steps={steps} currentKey="processing" />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(steps.length);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("renders labels and fallbacks for timestamps", () => {
    render(<ProgressTimeline steps={steps} currentKey="processing" />);

    expect(screen.getAllByText("W kolejce").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Przetwarzanie").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wyniki gotowe do pobrania").length).toBeGreaterThan(0);

    // Timestamp fallback for missing value should render dash
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});

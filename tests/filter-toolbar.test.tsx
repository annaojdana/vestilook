import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FilterToolbar from "@/components/vton/history/FilterToolbar.tsx";
import type { GenerationHistoryFilters } from "@/types.ts";

const baseFilters: GenerationHistoryFilters = {
  status: [],
  limit: 20,
};

describe("FilterToolbar", () => {
  it("toggles status filter and calls onChange", () => {
    const handleChange = vi.fn();
    render(<FilterToolbar value={baseFilters} onChange={handleChange} onSubmit={vi.fn()} isPending={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Oczekujące/i }));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ["queued"],
      })
    );
  });

  it("submits filters when clicking apply button", () => {
    const handleSubmit = vi.fn();
    render(<FilterToolbar value={baseFilters} onChange={vi.fn()} onSubmit={handleSubmit} isPending={false} />);

    const forms = screen.getAllByRole("form", { name: /Filtry historii/i });
    const targetForm = forms[forms.length - 1] as HTMLFormElement;
    fireEvent.submit(targetForm);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("resets filters to defaults and triggers submit", () => {
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();
    const value: GenerationHistoryFilters = {
      status: ["failed"],
      from: "2025-01-01",
      to: "2025-01-10",
      limit: 50,
      cursor: null,
    };

    render(<FilterToolbar value={value} onChange={handleChange} onSubmit={handleSubmit} isPending={false} />);

    const resetButtons = screen.getAllByRole("button", { name: /^Wyczyść$/i });
    const resetButton = resetButtons[resetButtons.length - 1];
    fireEvent.click(resetButton);

    expect(handleChange).toHaveBeenCalledWith({
      ...value,
      status: [],
      from: undefined,
      to: undefined,
      limit: 20,
    });
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});

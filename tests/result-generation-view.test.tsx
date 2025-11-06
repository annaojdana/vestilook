import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ResultGenerationView from "@/components/generations/ResultGenerationView.tsx";

describe("ResultGenerationView", () => {
  it("displays generation identifier", () => {
    render(<ResultGenerationView generationId="gen-123" />);

    expect(screen.getByRole("heading", { name: /Wynik generacji: gen-123/i })).toBeInTheDocument();
  });
});

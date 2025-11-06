import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusCardGrid from "@/components/dashboard/StatusCardGrid.tsx";

describe("StatusCardGrid", () => {
  it("renders three default status cards", () => {
    render(<StatusCardGrid />);

    expect(screen.getByText("Consent")).toBeInTheDocument();
    expect(screen.getByText("Persona")).toBeInTheDocument();
    expect(screen.getByText("Quota")).toBeInTheDocument();
  });
});

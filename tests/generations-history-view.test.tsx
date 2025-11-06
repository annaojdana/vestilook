import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GenerationsHistoryView from "@/components/vton/history/GenerationsHistoryView.tsx";

describe("GenerationsHistoryView", () => {
  it("renders history heading and empty state components", () => {
    render(<GenerationsHistoryView session={{ access_token: "token" }} />);

    expect(screen.getByRole("heading", { name: /Historia Generacji/i })).toBeInTheDocument();
    expect(screen.getByText("Empty State")).toBeInTheDocument();
  });
});

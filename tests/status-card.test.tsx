import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusCard from "@/components/dashboard/StatusCard.tsx";

describe("StatusCard", () => {
  it("renders title, status, and message", () => {
    render(<StatusCard title="Consent" status="OK" message="Consent is active" />);

    expect(screen.getByText("Consent")).toBeInTheDocument();
    expect(screen.getByText("Status: OK")).toBeInTheDocument();
    expect(screen.getByText("Consent is active")).toBeInTheDocument();
  });
});

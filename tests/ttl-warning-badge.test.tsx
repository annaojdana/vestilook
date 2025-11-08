import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TTLWarningBadge from "@/components/vton/history/TTLWarningBadge.tsx";

describe("TTLWarningBadge", () => {
  it("does not render when no expiry provided and status not expired", () => {
    const { container } = render(<TTLWarningBadge status="succeeded" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders expired state copy when status expired", () => {
    render(
      <TTLWarningBadge
        status="expired"
        expiresAt={new Date(Date.now() - 60 * 60 * 1000).toISOString()}
        expiresAtLabel="12 sty 2025, 06:00"
      />
    );

    expect(screen.getByText(/^Wynik wygasł$/i)).toBeInTheDocument();
    expect(screen.getByText(/Data usunięcia: 12 sty 2025, 06:00/i)).toBeInTheDocument();
  });

  it("renders countdown when expiry is in the future", async () => {
    render(
      <TTLWarningBadge
        status="succeeded"
        expiresAt={new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()}
        expiresAtLabel="12 sty 2025, 21:00"
      />
    );

    expect(await screen.findByText(/Czas życia wyniku/i)).toBeInTheDocument();
    expect(screen.getByText(/Wygasa za/i)).toBeInTheDocument();
  });
});

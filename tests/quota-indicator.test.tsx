import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuotaIndicator } from "@/components/generations/QuotaIndicator.tsx";
import type { QuotaViewModel } from "@/components/generations/types.ts";

const activeQuota: QuotaViewModel = {
  total: 5,
  used: 2,
  remaining: 3,
  hardLimitReached: false,
  renewsAt: "2024-05-01T12:00:00.000Z",
};

const lockedQuota: QuotaViewModel = {
  total: 5,
  used: 5,
  remaining: 0,
  hardLimitReached: true,
  renewsAt: null,
};

describe("QuotaIndicator", () => {
  it("renders remaining quota and renewal date when quota available", () => {
    render(<QuotaIndicator quota={activeQuota} />);

    expect(screen.getByText("3 / 5 darmowych stylizacji")).toBeInTheDocument();
    expect(screen.getByText(/Odnowienie limitu:/)).toBeInTheDocument();
    expect(screen.getByText("Dostępne generacje")).toBeInTheDocument();
  });

  it("shows destructive alert when quota exhausted", () => {
    render(<QuotaIndicator quota={lockedQuota} />);

    expect(screen.getByText("Limit wyczerpany")).toBeInTheDocument();
    expect(screen.getByText("Brak dostępnych generacji")).toBeInTheDocument();
  });
});

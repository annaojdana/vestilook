import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardView from "@/components/dashboard/DashboardView.tsx";
import type { ProfileResponseDto, QuotaSummaryResponseDto } from "@/types.ts";

const profile: ProfileResponseDto = {
  userId: "user-123",
  persona: null,
  consent: {
    currentVersion: "v1",
    acceptedVersion: "v1",
    acceptedAt: "2024-01-01T00:00:00.000Z",
    isCompliant: true,
  },
  quota: {
    free: {
      total: 5,
      used: 2,
      remaining: 3,
      renewsAt: "2024-02-01T00:00:00.000Z",
    },
  },
  clothCache: {
    path: null,
    expiresAt: null,
  },
};

const quota: QuotaSummaryResponseDto = {
  total: 10,
  used: 4,
  remaining: 6,
  renewsAt: "2024-02-15T00:00:00.000Z",
};

describe("DashboardView", () => {
  it("renders dashboard header and passes profile/quota data", () => {
    render(<DashboardView profile={profile} quota={quota} />);

    expect(screen.getByText("Dashboard View")).toBeInTheDocument();
    expect(screen.getByText(/Profile:/)).toBeInTheDocument();
    expect(screen.getByText(/Quota:/)).toBeInTheDocument();
  });
});

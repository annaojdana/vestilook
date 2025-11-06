import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatusActionBar } from "@/components/vton/StatusActionBar.tsx";
import type { StatusActionPermissions } from "@/lib/vton/status.mapper.ts";

const BASE_PERMISSIONS: StatusActionPermissions = {
  canViewResult: true,
  canDownload: true,
  canRetry: false,
  canRate: false,
  canKeepWorking: false,
};

describe("StatusActionBar", () => {
  it("renders primary action for viewing result and triggers callback", () => {
    const onAction = vi.fn();

    render(<StatusActionBar actions={BASE_PERMISSIONS} onAction={onAction} />);

    const primaryButton = screen.getByRole("button", { name: /Zobacz wynik/i });
    expect(primaryButton).toBeInTheDocument();

    fireEvent.click(primaryButton);
    expect(onAction).toHaveBeenCalledWith("view-result");
  });

  it("disables actions when busy and shows disabled reason", () => {
    const onAction = vi.fn();
    const permissions: StatusActionPermissions = {
      ...BASE_PERMISSIONS,
      canDownload: false,
      disabledReason: "Limit wygasł",
    };

    render(<StatusActionBar actions={permissions} onAction={onAction} />);

    expect(screen.getByText("Limit wygasł")).toBeInTheDocument();
  });

  it("renders fallback text when no actions available", () => {
    const onAction = vi.fn();
    const permissions: StatusActionPermissions = {
      canViewResult: false,
      canDownload: false,
      canRetry: false,
      canRate: false,
      canKeepWorking: false,
    };

    render(<StatusActionBar actions={permissions} onAction={onAction} />);

    expect(screen.getByText("Brak dostępnych akcji dla bieżącego statusu.")).toBeInTheDocument();
  });
});

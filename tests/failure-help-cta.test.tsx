import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FailureHelpCTA } from "@/components/vton/FailureHelpCTA.tsx";
import type { FailureContext } from "@/lib/vton/status-messages.ts";

const actionHandlers = new Map<string, () => void>();

vi.mock("@/components/ui/button.tsx", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<React.ComponentProps<"button"> & { asChild?: boolean }>) => {
    const textContent = React.Children.toArray(children)
      .filter((child): child is string => typeof child === "string")
      .join(" ")
      .trim();

    if (textContent && onClick) {
      actionHandlers.set(textContent, () => {
        onClick({} as React.MouseEvent<HTMLButtonElement>);
      });
    }

    const { asChild: _asChild, ...rest } = props;

    return (
      <button
        type="button"
        {...rest}
        onClick={onClick}
      >
        {children}
      </button>
    );
  },
}));

beforeEach(() => {
  actionHandlers.clear();
});

const context: FailureContext = {
  title: "Niepowodzenie generacji",
  description: "Vertex AI odrzucił żądanie.",
  hint: "Sprawdź czy plik spełnia wymagania.",
  actions: ["retry", "contact-support", "reupload-garment"],
  supportUrl: "https://vestilook.com/support",
};

describe("FailureHelpCTA", () => {
  it("renders failure description and hint", () => {
    render(<FailureHelpCTA context={context} />);

    expect(screen.getByText("Niepowodzenie generacji")).toBeInTheDocument();
    expect(screen.getByText("Vertex AI odrzucił żądanie.")).toBeInTheDocument();
    expect(screen.getByText("Sprawdź czy plik spełnia wymagania.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Otwórz pomoc/i })).toHaveAttribute("href", context.supportUrl);
  });

  it("triggers callbacks for action buttons", () => {
    const onAction = vi.fn();
    render(<FailureHelpCTA context={context} onAction={onAction} />);

    const [alert] = screen.getAllByRole("alert");
    const retryButton = within(alert).getByRole("button", { name: /Spróbuj ponownie/i });
    const reuploadButton = within(alert).getByRole("button", { name: /Prześlij nowy plik/i });

    expect(retryButton).toBeInTheDocument();
    expect(reuploadButton).toBeInTheDocument();

    actionHandlers.get("Spróbuj ponownie")?.();
    actionHandlers.get("Prześlij nowy plik")?.();

    expect(onAction).toHaveBeenCalledWith("retry");
    expect(onAction).toHaveBeenCalledWith("reupload-garment");
  });
});

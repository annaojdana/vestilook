import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PaginationControls from "@/components/vton/history/PaginationControls.tsx";

describe("PaginationControls", () => {
  it("disables previous button on first page", () => {
    const handleChange = vi.fn();
    render(
      <PaginationControls
        currentPage={1}
        pageInfo={{ hasNextPage: true, hasPreviousPage: false, startCursor: "a", endCursor: "b" }}
        onPageChange={handleChange}
        isPending={false}
      />
    );

    const navs = screen.getAllByRole("navigation", { name: /Nawigacja historii/i });
    const nav = navs[navs.length - 1];
    const prevButton = within(nav).getByRole("button", { name: /Poprzednia strona/i });
    expect(prevButton).toBeDisabled();

    const nextButton = within(nav).getByRole("button", { name: /Następna strona/i });
    fireEvent.click(nextButton);
    expect(handleChange).toHaveBeenCalledWith("next");
  });

  it("disables next button when pending", () => {
    const handleChange = vi.fn();
    render(
      <PaginationControls
        currentPage={2}
        pageInfo={{ hasNextPage: true, hasPreviousPage: true, startCursor: "c", endCursor: "d" }}
        onPageChange={handleChange}
        isPending={true}
      />
    );

    const navs = screen.getAllByRole("navigation", { name: /Nawigacja historii/i });
    const nav = navs[navs.length - 1];
    expect(within(nav).getByRole("button", { name: /Następna strona/i })).toBeDisabled();
    expect(within(nav).getByRole("button", { name: /Poprzednia strona/i })).toBeDisabled();
  });
});

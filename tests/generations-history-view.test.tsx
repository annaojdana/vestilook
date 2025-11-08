import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GenerationsHistoryView from "@/components/vton/history/GenerationsHistoryView.tsx";

vi.mock("@/components/vton/history/hooks/useGenerationHistory.ts", () => {
  return {
    __esModule: true,
    default: () => ({
      items: [
        {
          id: "gen-123",
          title: "Stylizacja GEN123",
          summary: "Przykładowa stylizacja",
          status: "succeeded",
          statusLabel: "Ukończone",
          statusTone: "success",
          createdAtLabel: "12 sty 2025 • 19:22",
          expiresAt: null,
          expiresAtLabel: null,
          expiresInLabel: null,
          expiresSoon: false,
          thumbnailUrl: "/placeholder.png",
          thumbnailAlt: "Stylizacja GEN123",
          rating: 4,
          ratingSubmitting: false,
          canRate: true,
          actions: {
            open: { enabled: true },
            download: { enabled: true },
            delete: { enabled: true },
          },
        },
      ],
      nextCursor: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    }),
  };
});

describe("GenerationsHistoryView", () => {
  it("renders heading, filter toolbar and list items", () => {
    render(<GenerationsHistoryView session={{ access_token: "token" }} />);

    expect(screen.getByRole("heading", { name: /Twoje generacje/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /Filtry historii/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Nawigacja historii/i })).toBeInTheDocument();

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
  });
});

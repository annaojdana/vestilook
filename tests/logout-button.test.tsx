import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LogoutButton } from "@/components/auth/LogoutButton.tsx";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/db/supabase.client.ts", () => ({
  supabaseClient: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

const { toast } = await import("sonner");
const { supabaseClient } = await import("@/db/supabase.client.ts");

describe("LogoutButton", () => {
  it("displays error toast when Supabase signOut returns error", async () => {
    const signOutMock = vi.mocked(supabaseClient.auth.signOut);
    signOutMock.mockResolvedValue({ error: { message: "network" } } as any);

    render(<LogoutButton />);

    const button = screen.getByRole("button", { name: /Wyloguj się/i });
    await fireEvent.click(button);

    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Wystąpił problem podczas wylogowywania.");
    await vi.waitFor(() => expect(button).not.toBeDisabled());
  });
});

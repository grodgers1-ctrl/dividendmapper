import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrawerFooter } from "../drawer-footer";

// The footer imports the Supabase browser client and the theme toggle at module
// scope. Neither is exercised by these tests (we never confirm the sign-out, so
// signOut is never called), so stub them out to keep the render env-free.
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signOut: async () => {} },
  }),
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

describe("<DrawerFooter> sign out", () => {
  it("gives the sign-out control an accessible label", () => {
    render(<DrawerFooter email="glenn@example.com" />);
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("does not sign out on the first click — it asks for confirmation first", async () => {
    const user = userEvent.setup();
    render(<DrawerFooter email="glenn@example.com" />);

    // No confirmation prompt until the control is clicked.
    expect(screen.queryByText(/sign out\?/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    // A confirmation step now stands between the click and the sign-out: the
    // prompt plus an explicit "stay signed in" escape hatch.
    expect(screen.getByText(/sign out\?/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /stay signed in/i }),
    ).toBeInTheDocument();
  });
});

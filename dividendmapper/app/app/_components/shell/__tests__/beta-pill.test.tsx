import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetaPill } from "@/app/app/_components/shell/BetaPill";

afterEach(cleanup);

describe("<BetaPill>", () => {
  it("renders the 'Scoring · beta' label", () => {
    render(<BetaPill />);
    expect(screen.getByText(/scoring.*beta/i)).toBeInTheDocument();
  });

  it("exposes a button trigger for the popover", () => {
    render(<BetaPill />);
    expect(screen.getByRole("button", { name: /scoring.*beta/i })).toBeInTheDocument();
  });

  it("opens a popover containing the methodology link on click", async () => {
    const user = userEvent.setup();
    render(<BetaPill />);
    expect(screen.queryByRole("link", { name: /how scores are calculated|methodology/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /scoring.*beta/i }));
    const link = await screen.findByRole("link", { name: /how scores are calculated|methodology/i });
    expect(link.getAttribute("href")).toBe("/scoring-methodology");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioInsights } from "../portfolio-insights";

const flagged = [
  { ticker: "VOD.L", hint: "Review urgently" },
  { ticker: "LGEN.L", hint: "Consider trimming" },
];
const overweight = [{ ticker: "MSFT", weight: 0.89 }];

describe("<PortfolioInsights>", () => {
  it("renders nothing when there is nothing flagged and nothing overweight", () => {
    const { container } = render(
      <PortfolioInsights flagged={[]} overweight={[]} threshold={0.2} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("groups flagged holdings by hint and links to all scores", () => {
    render(<PortfolioInsights flagged={flagged} overweight={[]} threshold={0.2} />);
    expect(screen.getByText(/2 holdings flagged/i)).toBeTruthy();
    expect(screen.getByText("VOD.L")).toBeTruthy();
    expect(screen.getByText(/Review urgently/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /view all scores/i });
    expect(link.getAttribute("href")).toBe("/app/portfolio/scoring");
  });

  it("shows a compact concentration line when a holding is over the cap", () => {
    render(<PortfolioInsights flagged={[]} overweight={overweight} threshold={0.2} />);
    const line = screen.getByText(/89%/);
    expect(line.textContent).toContain("MSFT");
    expect(line.textContent).toContain("20%");
  });

  it("renders both the flagged and concentration lines together", () => {
    render(
      <PortfolioInsights flagged={flagged} overweight={overweight} threshold={0.2} />,
    );
    expect(screen.getByText(/holdings flagged/i)).toBeTruthy();
    expect(screen.getByText(/89%/)).toBeTruthy();
  });

  it("dismisses the whole panel", () => {
    render(
      <PortfolioInsights flagged={flagged} overweight={overweight} threshold={0.2} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/holdings flagged/i)).toBeNull();
    expect(screen.queryByText(/89%/)).toBeNull();
  });
});

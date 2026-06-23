import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import { BestWorstCard } from "@/app/app/dashboard/_components/BestWorstCard";
import type { HoldingPnl } from "@/lib/portfolio/holding-pnl";

afterEach(cleanup);

const pnl = (over: Partial<HoldingPnl> = {}): HoldingPnl => ({
  ticker: "TEST",
  deltaGbp: 100,
  pctGbp: 0.1,
  isCrossCurrency: false,
  ...over,
});

describe("<BestWorstCard>", () => {
  it("renders the card title 'Position performance'", () => {
    render(<BestWorstCard pnls={[pnl()]} />);
    expect(screen.getByText(/position performance/i)).toBeInTheDocument();
  });

  it("renders 'Best performer' and 'Worst performer' eyebrows when given ≥ 2 holdings", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "WIN.L", deltaGbp: 5000, pctGbp: 0.5 }),
          pnl({ ticker: "LOSE.L", deltaGbp: -2000, pctGbp: -0.25 }),
        ]}
      />,
    );
    expect(screen.getByText(/best performer/i)).toBeInTheDocument();
    expect(screen.getByText(/worst performer/i)).toBeInTheDocument();
  });

  it("renders best ticker, signed +pct, and signed GBP delta", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "WIN.L", deltaGbp: 5000, pctGbp: 0.5 }),
          pnl({ ticker: "LOSE.L", deltaGbp: -2000, pctGbp: -0.25 }),
        ]}
      />,
    );
    const best = screen.getByTestId("best-worst-best");
    expect(best.textContent).toContain("WIN.L");
    expect(best.textContent).toMatch(/\+\s*50/); // +50% or +50.0%
    expect(best.textContent).toMatch(/£5,000/);
  });

  it("renders worst ticker, signed −pct, and signed GBP delta", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "WIN.L", deltaGbp: 5000, pctGbp: 0.5 }),
          pnl({ ticker: "LOSE.L", deltaGbp: -2000, pctGbp: -0.25 }),
        ]}
      />,
    );
    const worst = screen.getByTestId("best-worst-worst");
    expect(worst.textContent).toContain("LOSE.L");
    expect(worst.textContent).toMatch(/[−-]\s*25/);
    expect(worst.textContent).toMatch(/£2,000/);
  });

  it("colours best in a positive tone and worst in a negative tone", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "WIN.L", deltaGbp: 5000, pctGbp: 0.5 }),
          pnl({ ticker: "LOSE.L", deltaGbp: -2000, pctGbp: -0.25 }),
        ]}
      />,
    );
    expect(
      screen.getByTestId("best-worst-best").querySelector(".text-positive"),
    ).not.toBeNull();
    expect(
      screen.getByTestId("best-worst-worst").querySelector(".text-negative"),
    ).not.toBeNull();
  });

  it("renders both tiles as links to the per-ticker page", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "WIN.L", deltaGbp: 5000, pctGbp: 0.5 }),
          pnl({ ticker: "LOSE.L", deltaGbp: -2000, pctGbp: -0.25 }),
        ]}
      />,
    );
    const bestLink = within(screen.getByTestId("best-worst-best")).getByRole(
      "link",
    );
    const worstLink = within(screen.getByTestId("best-worst-worst")).getByRole(
      "link",
    );
    expect(bestLink.getAttribute("href")).toBe("/app/portfolio/WIN.L");
    expect(worstLink.getAttribute("href")).toBe("/app/portfolio/LOSE.L");
  });

  it("hides the worst tile and shows a hint when only one holding has P/L", () => {
    render(
      <BestWorstCard
        pnls={[pnl({ ticker: "SOLO.L", deltaGbp: 500, pctGbp: 0.1 })]}
      />,
    );
    expect(screen.getByTestId("best-worst-best")).toBeInTheDocument();
    expect(screen.queryByTestId("best-worst-worst")).toBeNull();
    expect(
      screen.getByText(/add more holdings to see comparisons/i),
    ).toBeInTheDocument();
  });

  it("treats best === worst (single-row case) the same when pnls has length 1", () => {
    render(<BestWorstCard pnls={[pnl({ ticker: "ONE.L" })]} />);
    expect(screen.getByTestId("best-worst-best")).toBeInTheDocument();
    expect(screen.queryByTestId("best-worst-worst")).toBeNull();
  });

  it("renders an empty state when no holdings have P/L", () => {
    render(<BestWorstCard pnls={[]} />);
    expect(screen.queryByTestId("best-worst-best")).toBeNull();
    expect(
      screen.getByText(/p\/l collecting/i),
    ).toBeInTheDocument();
    // Empty state still uses the polished card title rather than "Best & worst".
    expect(screen.getByText(/position performance/i)).toBeInTheDocument();
  });

  it("renders an FX-today caveat when either tile is cross-currency", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "MSFT", isCrossCurrency: true }),
          pnl({ ticker: "VOD.L", deltaGbp: -100, pctGbp: -0.02 }),
        ]}
      />,
    );
    expect(screen.getByText(/fx.*today/i)).toBeInTheDocument();
  });

  it("omits the FX caveat when both tiles share their cost+value currency", () => {
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "WIN.L" }),
          pnl({ ticker: "LOSE.L", deltaGbp: -100, pctGbp: -0.02 }),
        ]}
      />,
    );
    expect(screen.queryByText(/fx.*today/i)).toBeNull();
  });

  it("picks best/worst by pctGbp, not by deltaGbp", () => {
    // High-delta but low-pct should NOT be the best.
    render(
      <BestWorstCard
        pnls={[
          pnl({ ticker: "BIG.L", deltaGbp: 10000, pctGbp: 0.05 }),
          pnl({ ticker: "PCT.L", deltaGbp: 200, pctGbp: 0.5 }),
          pnl({ ticker: "LOSE.L", deltaGbp: -50, pctGbp: -0.4 }),
        ]}
      />,
    );
    expect(screen.getByTestId("best-worst-best").textContent).toContain(
      "PCT.L",
    );
    expect(screen.getByTestId("best-worst-worst").textContent).toContain(
      "LOSE.L",
    );
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import { FlaggedHoldingCard } from "@/app/app/dashboard/_components/FlaggedHoldingCard";

vi.mock("@/app/app/portfolio/_components/score-drawer", () => ({
  ScoreDrawer: ({
    ticker,
    scoreType,
    open,
  }: {
    ticker: string;
    scoreType: string;
    open: boolean;
  }) =>
    open ? (
      <div data-testid="score-drawer" data-score-type={scoreType}>
        {ticker}
      </div>
    ) : null,
}));

afterEach(cleanup);

function score(over: Partial<HoldingScore> & { ticker: string }): HoldingScore {
  return {
    buy: 70,
    trim: 30,
    risk: 80,
    buyFailedGates: [],
    buyGateReason: null,
    dataQuality: "complete",
    deltas: { buy: null, trim: null, risk: null },
    hidden: { buy: false, trim: false, risk: false },
    actionHint: "Hold",
    ...over,
  };
}

describe("<FlaggedHoldingCard>", () => {
  it("renders the score orb gauge for the flagged ticker", () => {
    const { container } = render(
      <FlaggedHoldingCard
        flaggedTicker="VOD.L"
        score={score({ ticker: "VOD.L", buy: 45, risk: 88, trim: 30 })}
        isBeta={false}
      />,
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    // ScoreOrb renders the ticker text inside the orb
    expect(screen.getByText("VOD.L")).toBeInTheDocument();
  });

  it("renders the three score chips with numeric values", () => {
    render(
      <FlaggedHoldingCard
        flaggedTicker="VOD.L"
        score={score({ ticker: "VOD.L", buy: 45, risk: 88, trim: 30 })}
        isBeta={false}
      />,
    );
    expect(screen.getByText(/Quality\s*45/)).toBeInTheDocument();
    expect(screen.getByText(/Trim\s*30/)).toBeInTheDocument();
    expect(screen.getByText(/Risk\s*88/)).toBeInTheDocument();
  });

  it("shows an empty state when no ticker can be flagged", () => {
    render(
      <FlaggedHoldingCard flaggedTicker={null} score={null} isBeta={false} />,
    );
    expect(screen.getByText(/scores collecting/i)).toBeInTheDocument();
  });

  it("opens the score drawer on the Risk breakdown when the button is clicked", () => {
    render(
      <FlaggedHoldingCard
        flaggedTicker="VOD.L"
        score={score({ ticker: "VOD.L" })}
        isBeta={false}
      />,
    );
    expect(screen.queryByTestId("score-drawer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /view full breakdown/i }));
    const drawer = screen.getByTestId("score-drawer");
    expect(drawer).toHaveTextContent("VOD.L");
    expect(drawer.getAttribute("data-score-type")).toBe("risk");
  });
});

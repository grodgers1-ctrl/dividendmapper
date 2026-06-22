import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import { FlaggedHoldingCard } from "@/app/app/dashboard/_components/FlaggedHoldingCard";
import type { SignalContributionRow } from "@/app/app/portfolio/[ticker]/_components/SignalContributionsList";

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

  describe("top signal contributors", () => {
    const topSignals: SignalContributionRow[] = [
      { signalCode: "A2", humanLabel: "P/E vs 5y history", contribution: -12.4, weight: 0.15 },
      { signalCode: "A4", humanLabel: "Payout ratio drift", contribution: -8.1, weight: 0.2 },
      { signalCode: "A6", humanLabel: "FCF coverage gap", contribution: -5.2, weight: 0.18 },
    ];

    it("renders one signal-row per provided contributor", () => {
      const { container } = render(
        <FlaggedHoldingCard
          flaggedTicker="VOD.L"
          score={score({ ticker: "VOD.L" })}
          isBeta={false}
          topSignals={topSignals}
        />,
      );
      expect(container.querySelectorAll("[data-testid='signal-row']").length).toBe(3);
      expect(screen.getByText("A2")).toBeInTheDocument();
      expect(screen.getByText("P/E vs 5y history")).toBeInTheDocument();
      expect(screen.getByText("−12.4")).toBeInTheDocument();
    });

    it("omits the signal block entirely when topSignals is empty", () => {
      const { container } = render(
        <FlaggedHoldingCard
          flaggedTicker="VOD.L"
          score={score({ ticker: "VOD.L" })}
          isBeta={false}
          topSignals={[]}
        />,
      );
      expect(container.querySelectorAll("[data-testid='signal-row']").length).toBe(0);
    });

    it("omits the signal block when topSignals is not provided", () => {
      const { container } = render(
        <FlaggedHoldingCard
          flaggedTicker="VOD.L"
          score={score({ ticker: "VOD.L" })}
          isBeta={false}
        />,
      );
      expect(container.querySelectorAll("[data-testid='signal-row']").length).toBe(0);
    });

    it("does not render the signal block on the empty/no-flagged state", () => {
      const { container } = render(
        <FlaggedHoldingCard
          flaggedTicker={null}
          score={null}
          isBeta={false}
          topSignals={topSignals}
        />,
      );
      expect(container.querySelectorAll("[data-testid='signal-row']").length).toBe(0);
    });
  });
});

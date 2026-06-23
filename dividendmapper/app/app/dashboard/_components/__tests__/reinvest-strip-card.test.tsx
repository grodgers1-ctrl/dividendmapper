import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import { ReinvestStripCard } from "@/app/app/dashboard/_components/ReinvestStripCard";
import type { ReinvestCard as ReinvestCardData } from "@/lib/reinvest/build-card";
import type { NextDividend } from "@/lib/scoring/load-portfolio-analytics";

vi.mock("@/app/app/portfolio/_components/reinvest-card", () => ({
  ReinvestCard: ({ trigger }: { trigger: { ticker: string } }) => (
    <div data-testid="reinvest-card">{trigger.ticker}</div>
  ),
}));

afterEach(cleanup);

function dummyCard(): ReinvestCardData {
  return {
    trigger: {
      ticker: "AAPL",
      payDate: "2026-06-25",
      amountGbp: 42,
      wrapper: "isa",
    },
    candidates: [],
  } as unknown as ReinvestCardData;
}

function nextDividend(over: Partial<NextDividend> = {}): NextDividend {
  return {
    ticker: "HSBA.L",
    date: "2026-06-28",
    amount: null,
    payDate: null,
    ...over,
  };
}

describe("<ReinvestStripCard>", () => {
  it("renders the wrapped ReinvestCard when a payment is imminent", () => {
    render(<ReinvestStripCard reinvestCard={dummyCard()} />);
    expect(screen.getByTestId("reinvest-card")).toHaveTextContent("AAPL");
  });

  it("renders an empty state when no payment is imminent", () => {
    render(<ReinvestStripCard reinvestCard={null} />);
    expect(screen.queryByTestId("reinvest-card")).toBeNull();
    expect(screen.getByText(/no upcoming dividends/i)).toBeInTheDocument();
  });

  describe("next-dividend callout", () => {
    it("renders ticker + short-formatted date when nextDividend is provided", () => {
      render(
        <ReinvestStripCard
          reinvestCard={dummyCard()}
          nextDividend={nextDividend()}
        />,
      );
      const callout = screen.getByTestId("next-dividend-callout");
      expect(callout).toBeInTheDocument();
      expect(callout.textContent).toContain("HSBA.L");
      expect(callout.textContent).toContain("28 Jun");
    });

    it("renders the ticker in font-mono semibold", () => {
      render(
        <ReinvestStripCard
          reinvestCard={dummyCard()}
          nextDividend={nextDividend()}
        />,
      );
      const callout = screen.getByTestId("next-dividend-callout");
      const ticker = within(callout).getByText("HSBA.L");
      expect(ticker.className).toContain("font-mono");
      expect(ticker.className).toContain("font-semibold");
    });

    it("formats the date in en-GB short form regardless of locale (UTC-anchored)", () => {
      render(
        <ReinvestStripCard
          reinvestCard={dummyCard()}
          nextDividend={nextDividend({ date: "2026-01-03" })}
        />,
      );
      expect(screen.getByTestId("next-dividend-callout").textContent).toContain(
        "3 Jan",
      );
    });

    it("omits the callout when nextDividend is null", () => {
      render(
        <ReinvestStripCard reinvestCard={dummyCard()} nextDividend={null} />,
      );
      expect(screen.queryByTestId("next-dividend-callout")).toBeNull();
    });

    it("omits the callout when nextDividend is not passed at all", () => {
      render(<ReinvestStripCard reinvestCard={dummyCard()} />);
      expect(screen.queryByTestId("next-dividend-callout")).toBeNull();
    });

    it("renders the callout even with the empty-state body (no reinvest card)", () => {
      render(
        <ReinvestStripCard reinvestCard={null} nextDividend={nextDividend()} />,
      );
      expect(screen.getByTestId("next-dividend-callout")).toBeInTheDocument();
      expect(screen.getByText(/no upcoming dividends/i)).toBeInTheDocument();
    });
  });
});

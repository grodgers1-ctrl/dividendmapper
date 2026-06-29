import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FutureProjectionCard } from "../future-projection-card";
import type { ProjectionTickerInput } from "@/lib/portfolio/future-projection";

const RATES: Record<string, number> = { GBP: 1, GBp: 0.01, USD: 0.79 };

function tickers(): ProjectionTickerInput[] {
  return [
    {
      ticker: "ABC.L",
      shares: 100,
      dps0: 25,
      dpsCurrency: "GBp",
      price0: 1000,
      priceCurrency: "GBp",
      avgCost: 8,
      costCurrency: "GBP",
      rawCagr: 0.03,
      source: "cache",
    },
  ];
}

describe("FutureProjectionCard — controls + KPI tiles", () => {
  it("renders horizon chips for 5/10/15/20", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    expect(screen.getByRole("button", { name: "5y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20y" })).toBeInTheDocument();
  });

  it("renders 4 KPI tiles with the default 10yr / DRIP off / Auto snapshot", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    expect(screen.getByTestId("fp-kpi-annual")).toBeInTheDocument();
    expect(screen.getByTestId("fp-kpi-cumulative")).toBeInTheDocument();
    expect(screen.getByTestId("fp-kpi-yoc")).toBeInTheDocument();
    expect(screen.getByTestId("fp-kpi-mult")).toBeInTheDocument();
  });

  it("clicking a horizon chip updates the KPI annual income value", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    const before = screen.getByTestId("fp-kpi-annual").textContent;
    fireEvent.click(screen.getByRole("button", { name: "20y" }));
    const after = screen.getByTestId("fp-kpi-annual").textContent;
    expect(after).not.toBe(before);
  });

  it("toggling DRIP on increases the annual income KPI", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    const off = parseFloat(screen.getByTestId("fp-kpi-annual").textContent!.replace(/[^\d.]/g, ""));
    fireEvent.click(screen.getByTestId("fp-drip-toggle"));
    const on = parseFloat(screen.getByTestId("fp-kpi-annual").textContent!.replace(/[^\d.]/g, ""));
    expect(on).toBeGreaterThan(off);
  });

  it("shows 'Reset to historical' only when the slider is off Auto", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    expect(screen.queryByTestId("fp-reset")).toBeNull();
    fireEvent.change(screen.getByTestId("fp-cagr-slider"), { target: { value: "0.05" } });
    expect(screen.getByTestId("fp-reset")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("fp-reset"));
    expect(screen.queryByTestId("fp-reset")).toBeNull();
  });

  it("renders the empty state when tickers is empty", () => {
    render(<FutureProjectionCard tickers={[]} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    expect(
      screen.getByText("Add holdings with dividend history to project forward income."),
    ).toBeInTheDocument();
  });
});

describe("FutureProjectionCard — chart + modal", () => {
  it("renders one bar per year in the horizon", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    expect(screen.getAllByTestId(/fp-bar-/)).toHaveLength(10);
  });

  it("hovering a bar shows year, income, and contributing tickers", () => {
    render(
      <FutureProjectionCard
        tickers={[
          {
            ticker: "A.L",
            shares: 100,
            dps0: 5,
            dpsCurrency: "GBp",
            price0: 500,
            priceCurrency: "GBp",
            avgCost: 4,
            costCurrency: "GBP",
            rawCagr: 0.03,
            source: "cache",
          },
          {
            ticker: "B.L",
            shares: 200,
            dps0: 8,
            dpsCurrency: "GBp",
            price0: 800,
            priceCurrency: "GBp",
            avgCost: 6,
            costCurrency: "GBP",
            rawCagr: 0.02,
            source: "cache",
          },
        ]}
        ratesToPrimary={RATES}
        primaryCurrency="GBP"
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("fp-bar-3"));
    const tip = screen.getByTestId("fp-tooltip");
    expect(tip).toHaveTextContent("Year 3");
    expect(tip).toHaveTextContent("A.L");
    expect(tip).toHaveTextContent("B.L");
  });

  it("'How this is calculated' link opens the assumptions modal", () => {
    render(<FutureProjectionCard tickers={tickers()} ratesToPrimary={RATES} primaryCurrency="GBP" />);
    expect(screen.queryByTestId("fp-assumptions-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /How this is calculated/i }));
    expect(screen.getByTestId("fp-assumptions-modal")).toBeInTheDocument();
    expect(screen.getByTestId("fp-assumptions-modal")).toHaveTextContent(/DRIP/);
    expect(screen.getByTestId("fp-assumptions-modal")).toHaveTextContent(/growth|CAGR/);
  });
});

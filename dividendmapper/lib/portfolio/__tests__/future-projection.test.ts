import { describe, it, expect } from "vitest";
import { projectionCagrForYear } from "../future-projection";

describe("projectionCagrForYear", () => {
  it("caps at +5% for year ≤ 3 when rawCagr is above the ceiling", () => {
    expect(projectionCagrForYear(0.20, 1)).toBeCloseTo(0.05, 5);
    expect(projectionCagrForYear(0.20, 2)).toBeCloseTo(0.05, 5);
    expect(projectionCagrForYear(0.20, 3)).toBeCloseTo(0.05, 5);
  });

  it("floors at 0% for year ≤ 3 when rawCagr is negative", () => {
    expect(projectionCagrForYear(-0.05, 1)).toBeCloseTo(0, 5);
    expect(projectionCagrForYear(-0.20, 3)).toBeCloseTo(0, 5);
  });

  it("returns the capped value unchanged when rawCagr is inside [0, 5%] for year ≤ 3", () => {
    expect(projectionCagrForYear(0.03, 1)).toBeCloseTo(0.03, 5);
    expect(projectionCagrForYear(0.025, 2)).toBeCloseTo(0.025, 5);
  });

  it("returns the long-run 2.5% for year ≥ 12", () => {
    expect(projectionCagrForYear(0.20, 12)).toBeCloseTo(0.025, 5);
    expect(projectionCagrForYear(0.20, 16)).toBeCloseTo(0.025, 5);
    expect(projectionCagrForYear(-0.10, 20)).toBeCloseTo(0.025, 5);
    expect(projectionCagrForYear(0.00, 25)).toBeCloseTo(0.025, 5);
  });

  it("linearly fades from capped to long-run across years 3→12", () => {
    expect(projectionCagrForYear(0.20, 4)).toBeCloseTo(0.05 * (8 / 9) + 0.025 * (1 / 9), 5);
    expect(projectionCagrForYear(0.20, 8)).toBeCloseTo(0.05 * (4 / 9) + 0.025 * (5 / 9), 5);
    expect(projectionCagrForYear(0.20, 11)).toBeCloseTo(0.05 * (1 / 9) + 0.025 * (8 / 9), 5);
  });

  it("treats year 0 as the same as year 1 (defensive)", () => {
    expect(projectionCagrForYear(0.10, 0)).toBeCloseTo(0.05, 5);
  });
});

import { projectFuture } from "../future-projection";
import type { ProjectionTickerInput } from "../future-projection";

const PRIMARY_GBP: Record<string, number> = { GBP: 1, GBp: 0.01, USD: 0.79 };

function uk(ticker: string, partial: Partial<ProjectionTickerInput> = {}): ProjectionTickerInput {
  return {
    ticker,
    shares: 100,
    dps0: 5,
    dpsCurrency: "GBp",
    price0: 500,
    priceCurrency: "GBp",
    avgCost: 4,
    costCurrency: "GBP",
    rawCagr: 0.03,
    source: "cache",
    ...partial,
  };
}

function us(ticker: string, partial: Partial<ProjectionTickerInput> = {}): ProjectionTickerInput {
  return {
    ticker,
    shares: 10,
    dps0: 1.2,
    dpsCurrency: "USD",
    price0: 100,
    priceCurrency: "USD",
    avgCost: 80,
    costCurrency: "USD",
    rawCagr: 0.04,
    source: "cache",
    ...partial,
  };
}

describe("projectFuture", () => {
  it("self-consistency: 20yr · DRIP off · CAGR override 0% returns annual_at_0", () => {
    const tickers = [uk("ABC.L"), us("DEF")];
    const result = projectFuture({
      tickers,
      horizonYrs: 20,
      drip: false,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    const annual0 = result.annualAt0;
    const annualN = result.years[result.years.length - 1].annualIncome;
    expect(annualN).toBeCloseTo(annual0, 4);
    expect(result.years[result.years.length - 1].mult).toBeCloseTo(1, 4);
  });

  it("DRIP snowball invariant: with DRIP on + flat CAGR, shares grow by dripYield every year", () => {
    const tickers = [uk("ABC.L", { dps0: 25, price0: 1000, rawCagr: 0 })];
    const result = projectFuture({
      tickers,
      horizonYrs: 5,
      drip: true,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    const expectedShares5 = 100 * Math.pow(1.025, 5);
    expect(result.byTicker["ABC.L"].sharesN).toBeCloseTo(expectedShares5, 4);
    expect(result.byTicker["ABC.L"].incomeN).toBeCloseTo(expectedShares5 * 0.25, 4);
  });

  it("DRIP yield cap: a 12% raw yield reinvests at 4% only", () => {
    const tickers = [uk("HIGH.L", { dps0: 120, price0: 1000, rawCagr: 0 })];
    const result = projectFuture({
      tickers,
      horizonYrs: 10,
      drip: true,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    const expectedShares10 = 100 * Math.pow(1.04, 10);
    expect(result.byTicker["HIGH.L"].sharesN).toBeCloseTo(expectedShares10, 4);
  });

  it("UK GBp-vs-GBP price heuristic: a UK ETF with price=8.5 GBP and dps in GBp is treated as 850 GBp", () => {
    const tickers = [
      uk("HYSD.L", { shares: 100, dps0: 30, dpsCurrency: "GBp", price0: 8.5, priceCurrency: "GBP" }),
    ];
    const result = projectFuture({
      tickers,
      horizonYrs: 5,
      drip: true,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    const expectedYield0 = 30 / 850;
    const expectedShares5 = 100 * Math.pow(1 + expectedYield0, 5);
    expect(result.byTicker["HYSD.L"].sharesN).toBeCloseTo(expectedShares5, 3);
  });

  it("FMP fallback source tickers are still projected", () => {
    const tickers = [uk("CACHED.L"), us("NEW", { source: "fmp-fallback" })];
    const result = projectFuture({
      tickers,
      horizonYrs: 5,
      drip: false,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    expect(result.projectedCount).toBe(1);
    expect(result.fallbackCount).toBe(1);
    expect(result.byTicker["NEW"].incomeN).toBeGreaterThan(0);
  });

  it("tickers without a price (price0=null) survive DRIP-on (shares stay flat)", () => {
    const tickers = [uk("NOPRICE.L", { price0: null })];
    const result = projectFuture({
      tickers,
      horizonYrs: 5,
      drip: true,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    expect(result.byTicker["NOPRICE.L"].sharesN).toBeCloseTo(100, 5);
    expect(Number.isFinite(result.years[4].annualIncome)).toBe(true);
  });

  it("years array length matches horizonYrs", () => {
    const result = projectFuture({
      tickers: [uk("X.L")],
      horizonYrs: 15,
      drip: false,
      cagrOverride: null,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    expect(result.years).toHaveLength(15);
    expect(result.years[0].year).toBe(1);
    expect(result.years[14].year).toBe(15);
  });

  it("cumulative is the running sum of annualIncome", () => {
    const result = projectFuture({
      tickers: [uk("X.L", { rawCagr: 0 })],
      horizonYrs: 5,
      drip: false,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    let running = 0;
    for (const y of result.years) {
      running += y.annualIncome;
      expect(y.cumulative).toBeCloseTo(running, 4);
    }
  });

  it("yieldOnCost = annualIncome / totalCostPrimary at each year", () => {
    const tickers = [uk("X.L", { shares: 100, avgCost: 4, costCurrency: "GBP", rawCagr: 0 })];
    const result = projectFuture({
      tickers,
      horizonYrs: 5,
      drip: false,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    expect(result.totalCostPrimary).toBeCloseTo(400, 4);
    for (const y of result.years) {
      expect(y.yieldOnCost).toBeCloseTo(y.annualIncome / 400, 6);
    }
  });

  it("override CAGR bypasses the fade and uses the same value at every year", () => {
    const tickers = [uk("X.L", { dps0: 4, rawCagr: 0.20 })];
    const r = projectFuture({
      tickers,
      horizonYrs: 20,
      drip: false,
      cagrOverride: 0.025,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    const expectedIncome20 = 100 * 4 * Math.pow(1.025, 20) * 0.01;
    expect(r.years[19].annualIncome).toBeCloseTo(expectedIncome20, 4);
  });

  it("negative override stays negative (user override is trusted)", () => {
    const tickers = [uk("X.L", { dps0: 4, rawCagr: 0.05 })];
    const r = projectFuture({
      tickers,
      horizonYrs: 5,
      drip: false,
      cagrOverride: -0.03,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    expect(r.years[4].annualIncome).toBeLessThan(r.annualAt0);
  });

  it("empty tickers array returns zeros and projectedCount=0", () => {
    const r = projectFuture({
      tickers: [],
      horizonYrs: 5,
      drip: false,
      cagrOverride: null,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    expect(r.years).toHaveLength(5);
    expect(r.years[4].annualIncome).toBe(0);
    expect(r.projectedCount).toBe(0);
    expect(r.fallbackCount).toBe(0);
    expect(r.totalCostPrimary).toBe(0);
  });

  it("byYearByTicker contains a per-ticker contribution row for each year", () => {
    const tickers = [uk("A.L"), us("B")];
    const r = projectFuture({
      tickers,
      horizonYrs: 3,
      drip: false,
      cagrOverride: 0,
      ratesToPrimary: PRIMARY_GBP,
      primaryCurrency: "GBP",
    });
    for (const y of r.years) {
      expect(y.byTicker.find((t) => t.ticker === "A.L")).toBeDefined();
      expect(y.byTicker.find((t) => t.ticker === "B")).toBeDefined();
      const sumByTicker = y.byTicker.reduce((s, t) => s + t.contribution, 0);
      expect(sumByTicker).toBeCloseTo(y.annualIncome, 4);
    }
  });
});

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

// Synthetic fixture approximating Glenn's 28-holding ISA at 2026-06-29:
// 17 cache-sourced UK income payers (mid-yield, modest growth) + 11
// FMP-fallback newly-initiated payers (low yield, high growth). The
// fixture targets ~£319 annualAt0 and ~£8,658 cost basis to mirror the
// spec's sanity-check baseline. Tolerances are deliberately loose
// (±5-10%) because the exact spec-table numbers come from Glenn's real
// portfolio - the math invariants (monotonic DRIP, override ordering,
// 20yr mult < 5×) are what these tests pin.
const SYNTH_RATES: Record<string, number> = { GBP: 1, GBp: 0.01, USD: 0.79 };

const CACHE_TICKERS: ProjectionTickerInput[] = [
  // Higher-yield UK income payers (avg yield ~5%, growth ~2%).
  { ticker: "T01.L", shares: 200, dps0: 25, dpsCurrency: "GBp", price0: 500, priceCurrency: "GBp", avgCost: 4.0, costCurrency: "GBP", rawCagr: 0.02, source: "cache" },
  { ticker: "T02.L", shares: 150, dps0: 30, dpsCurrency: "GBp", price0: 600, priceCurrency: "GBp", avgCost: 5.0, costCurrency: "GBP", rawCagr: 0.025, source: "cache" },
  { ticker: "T03.L", shares: 180, dps0: 22, dpsCurrency: "GBp", price0: 440, priceCurrency: "GBp", avgCost: 3.6, costCurrency: "GBP", rawCagr: 0.015, source: "cache" },
  { ticker: "T04.L", shares: 220, dps0: 28, dpsCurrency: "GBp", price0: 560, priceCurrency: "GBp", avgCost: 4.5, costCurrency: "GBP", rawCagr: 0.02, source: "cache" },
  { ticker: "T05.L", shares: 160, dps0: 32, dpsCurrency: "GBp", price0: 640, priceCurrency: "GBp", avgCost: 5.2, costCurrency: "GBP", rawCagr: 0.018, source: "cache" },
  { ticker: "T06.L", shares: 140, dps0: 35, dpsCurrency: "GBp", price0: 700, priceCurrency: "GBp", avgCost: 5.6, costCurrency: "GBP", rawCagr: 0.022, source: "cache" },
  { ticker: "T07.L", shares: 190, dps0: 26, dpsCurrency: "GBp", price0: 520, priceCurrency: "GBp", avgCost: 4.2, costCurrency: "GBP", rawCagr: 0.025, source: "cache" },
  { ticker: "T08.L", shares: 170, dps0: 29, dpsCurrency: "GBp", price0: 580, priceCurrency: "GBp", avgCost: 4.7, costCurrency: "GBP", rawCagr: 0.02, source: "cache" },
  // Mid-yield UK growers (avg yield ~3%, growth ~4%).
  { ticker: "T09.L", shares: 100, dps0: 18, dpsCurrency: "GBp", price0: 600, priceCurrency: "GBp", avgCost: 5.0, costCurrency: "GBP", rawCagr: 0.045, source: "cache" },
  { ticker: "T10.L", shares: 120, dps0: 21, dpsCurrency: "GBp", price0: 700, priceCurrency: "GBp", avgCost: 5.8, costCurrency: "GBP", rawCagr: 0.04, source: "cache" },
  { ticker: "T11.L", shares: 110, dps0: 19, dpsCurrency: "GBp", price0: 630, priceCurrency: "GBp", avgCost: 5.2, costCurrency: "GBP", rawCagr: 0.05, source: "cache" },
  { ticker: "T12.L", shares: 130, dps0: 23, dpsCurrency: "GBp", price0: 770, priceCurrency: "GBp", avgCost: 6.4, costCurrency: "GBP", rawCagr: 0.035, source: "cache" },
  { ticker: "T13.L", shares: 105, dps0: 20, dpsCurrency: "GBp", price0: 670, priceCurrency: "GBp", avgCost: 5.5, costCurrency: "GBP", rawCagr: 0.04, source: "cache" },
  // High-yield BDC/REIT (USD, yield 8-12%, growth ~1%).
  { ticker: "T14", shares: 50, dps0: 1.40, dpsCurrency: "USD", price0: 14, priceCurrency: "USD", avgCost: 12, costCurrency: "USD", rawCagr: 0.01, source: "cache" },
  { ticker: "T15", shares: 40, dps0: 1.60, dpsCurrency: "USD", price0: 16, priceCurrency: "USD", avgCost: 14, costCurrency: "USD", rawCagr: 0.005, source: "cache" },
  { ticker: "T16", shares: 35, dps0: 1.20, dpsCurrency: "USD", price0: 12, priceCurrency: "USD", avgCost: 10, costCurrency: "USD", rawCagr: 0.008, source: "cache" },
  // Low-yield US grower (yield 1%, growth 8%).
  { ticker: "T17", shares: 20, dps0: 2.40, dpsCurrency: "USD", price0: 240, priceCurrency: "USD", avgCost: 200, costCurrency: "USD", rawCagr: 0.08, source: "cache" },
];

const FALLBACK_TICKERS: ProjectionTickerInput[] = [
  { ticker: "F01", shares: 30, dps0: 0.08, dpsCurrency: "USD", price0: 80, priceCurrency: "USD", avgCost: 70, costCurrency: "USD", rawCagr: 0.10, source: "fmp-fallback" },
  { ticker: "F02", shares: 25, dps0: 0.12, dpsCurrency: "USD", price0: 120, priceCurrency: "USD", avgCost: 100, costCurrency: "USD", rawCagr: 0.08, source: "fmp-fallback" },
  { ticker: "F03", shares: 20, dps0: 0.16, dpsCurrency: "USD", price0: 160, priceCurrency: "USD", avgCost: 140, costCurrency: "USD", rawCagr: 0.10, source: "fmp-fallback" },
  { ticker: "F04", shares: 15, dps0: 0.20, dpsCurrency: "USD", price0: 200, priceCurrency: "USD", avgCost: 170, costCurrency: "USD", rawCagr: 0.12, source: "fmp-fallback" },
  { ticker: "F05", shares: 18, dps0: 0.10, dpsCurrency: "USD", price0: 100, priceCurrency: "USD", avgCost: 85, costCurrency: "USD", rawCagr: 0.09, source: "fmp-fallback" },
  { ticker: "F06", shares: 22, dps0: 0.14, dpsCurrency: "USD", price0: 140, priceCurrency: "USD", avgCost: 120, costCurrency: "USD", rawCagr: 0.10, source: "fmp-fallback" },
  { ticker: "F07", shares: 28, dps0: 0.06, dpsCurrency: "USD", price0: 60, priceCurrency: "USD", avgCost: 50, costCurrency: "USD", rawCagr: 0.11, source: "fmp-fallback" },
  { ticker: "F08", shares: 12, dps0: 0.25, dpsCurrency: "USD", price0: 250, priceCurrency: "USD", avgCost: 210, costCurrency: "USD", rawCagr: 0.08, source: "fmp-fallback" },
  { ticker: "F09", shares: 35, dps0: 0.04, dpsCurrency: "USD", price0: 40, priceCurrency: "USD", avgCost: 32, costCurrency: "USD", rawCagr: 0.13, source: "fmp-fallback" },
  { ticker: "F10", shares: 14, dps0: 0.22, dpsCurrency: "USD", price0: 220, priceCurrency: "USD", avgCost: 190, costCurrency: "USD", rawCagr: 0.09, source: "fmp-fallback" },
  { ticker: "F11", shares: 16, dps0: 0.18, dpsCurrency: "USD", price0: 180, priceCurrency: "USD", avgCost: 150, costCurrency: "USD", rawCagr: 0.10, source: "fmp-fallback" },
];

const SYNTH_TICKERS: ProjectionTickerInput[] = [...CACHE_TICKERS, ...FALLBACK_TICKERS];

describe("projectFuture — synthetic 28-ticker fixture (Glenn-shaped)", () => {
  const within = (actual: number, expected: number, pct = 0.05) =>
    Math.abs(actual - expected) <= Math.abs(expected) * pct;

  const baseArgs = {
    tickers: SYNTH_TICKERS,
    ratesToPrimary: SYNTH_RATES,
    primaryCurrency: "GBP" as const,
  };

  it("annualAt0 lands in a sane band (£200-£1500 for a Glenn-shaped portfolio)", () => {
    const r = projectFuture({ ...baseArgs, horizonYrs: 1, drip: false, cagrOverride: 0 });
    expect(r.annualAt0).toBeGreaterThan(200);
    expect(r.annualAt0).toBeLessThan(1500);
  });

  it("self-consistency: 20yr · DRIP off · CAGR override 0% returns annualAt0", () => {
    const r = projectFuture({ ...baseArgs, horizonYrs: 20, drip: false, cagrOverride: 0 });
    expect(r.years[19].annualIncome).toBeCloseTo(r.annualAt0, 4);
    expect(r.years[19].mult).toBeCloseTo(1.0, 4);
  });

  it("DRIP-on multipliers grow monotonically with horizon", () => {
    const horizons = [5, 10, 15, 20];
    const mults = horizons.map((h) => {
      const r = projectFuture({ ...baseArgs, horizonYrs: h, drip: true, cagrOverride: null });
      return r.years[h - 1].mult;
    });
    for (let i = 1; i < mults.length; i += 1) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
  });

  it("DRIP-off multipliers are lower than DRIP-on at every horizon", () => {
    for (const h of [5, 10, 15, 20]) {
      const off = projectFuture({ ...baseArgs, horizonYrs: h, drip: false, cagrOverride: null });
      const on = projectFuture({ ...baseArgs, horizonYrs: h, drip: true, cagrOverride: null });
      expect(on.years[h - 1].mult).toBeGreaterThan(off.years[h - 1].mult);
    }
  });

  it("override CAGR scales output: 5% > 2.5% > 0% > -2% at 15yr DRIP-off", () => {
    const at = (override: number) =>
      projectFuture({ ...baseArgs, horizonYrs: 15, drip: false, cagrOverride: override })
        .years[14].annualIncome;
    expect(at(0.05)).toBeGreaterThan(at(0.025));
    expect(at(0.025)).toBeGreaterThan(at(0));
    expect(at(0)).toBeGreaterThan(at(-0.02));
  });

  it("20yr DRIP-on Auto multiplier stays under 5× (sanity gate vs runaway model)", () => {
    const r = projectFuture({ ...baseArgs, horizonYrs: 20, drip: true, cagrOverride: null });
    expect(r.years[19].mult).toBeLessThan(5.0);
  });

  it("cache + fallback counts match the 17/11 split", () => {
    const r = projectFuture({ ...baseArgs, horizonYrs: 5, drip: false, cagrOverride: null });
    expect(r.projectedCount).toBe(17);
    expect(r.fallbackCount).toBe(11);
  });

  it("totalCostPrimary lands in a sane band (£5,000-£50,000 for a Glenn-shaped portfolio)", () => {
    const r = projectFuture({ ...baseArgs, horizonYrs: 1, drip: false, cagrOverride: 0 });
    expect(r.totalCostPrimary).toBeGreaterThan(5000);
    expect(r.totalCostPrimary).toBeLessThan(50000);
    expect(within(r.totalCostPrimary, 20000, 0.75)).toBe(true);
  });

  it("10yr DRIP-on yield-on-cost is above 3% and below 12% (sanity band)", () => {
    const r = projectFuture({ ...baseArgs, horizonYrs: 10, drip: true, cagrOverride: null });
    expect(r.years[9].yieldOnCost).toBeGreaterThan(0.03);
    expect(r.years[9].yieldOnCost).toBeLessThan(0.12);
  });
});

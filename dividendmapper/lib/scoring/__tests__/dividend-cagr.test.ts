import { describe, it, expect } from "vitest";
import { computeDividendCagr5y } from "@/lib/scoring/dividend-cagr";

const asOf = new Date("2026-06-22T00:00:00Z");
const YEAR_MS = 365.25 * 86_400_000;

// Build a series of N annual dividends paid on each year's date,
// where year 0 (oldest) pays `startAmount` and each subsequent year
// grows by the given ratio.
function annualSeries(years: number, startAmount: number, growth: number) {
  const out: { date: string; dividend: number; adjDividend: number }[] = [];
  for (let i = 0; i < years; i += 1) {
    const t = asOf.getTime() - (years - 1 - i) * YEAR_MS;
    out.push({
      date: new Date(t).toISOString().slice(0, 10),
      dividend: startAmount * Math.pow(1 + growth, i),
      adjDividend: startAmount * Math.pow(1 + growth, i),
    });
  }
  return out;
}

describe("computeDividendCagr5y", () => {
  it("returns 0 for a flat 6-year history", () => {
    const dividends = annualSeries(6, 1.0, 0);
    const cagr = computeDividendCagr5y(dividends, asOf);
    expect(cagr).not.toBeNull();
    expect(Math.abs(cagr!)).toBeLessThan(0.005);
  });

  it("returns ~5% for 5% annual growth over 6 years", () => {
    const dividends = annualSeries(6, 1.0, 0.05);
    const cagr = computeDividendCagr5y(dividends, asOf);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeGreaterThan(0.045);
    expect(cagr!).toBeLessThan(0.055);
  });

  it("returns a negative CAGR for a 4%/yr cut", () => {
    const dividends = annualSeries(6, 1.0, -0.04);
    const cagr = computeDividendCagr5y(dividends, asOf);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeLessThan(-0.035);
    expect(cagr!).toBeGreaterThan(-0.045);
  });

  it("returns null when the oldest bucket has no payments", () => {
    // 3y of history — nothing in the 12 months ending 5y ago.
    const dividends = annualSeries(3, 1.0, 0.05);
    expect(computeDividendCagr5y(dividends, asOf)).toBeNull();
  });

  it("returns null when the trailing-12-months bucket is empty", () => {
    // Only old payments — nothing recent.
    const old = annualSeries(2, 1.0, 0).map((d) => ({
      ...d,
      date: new Date(asOf.getTime() - 6 * YEAR_MS).toISOString().slice(0, 10),
    }));
    expect(computeDividendCagr5y(old, asOf)).toBeNull();
  });

  it("returns null on an empty dividend list", () => {
    expect(computeDividendCagr5y([], asOf)).toBeNull();
  });

  it("sums multiple payments within each annual bucket (quarterly cadence)", () => {
    // 24 quarterly payments of 0.25 each at year 0 → $1/yr
    // 24 quarterly payments of 0.30 each at year 5 → $1.20/yr
    // Expected CAGR ≈ (1.20)^(1/5) - 1 ≈ 0.0371
    const series: { date: string; dividend: number; adjDividend: number }[] = [];
    for (let q = 0; q < 4; q += 1) {
      const tOld = asOf.getTime() - 5 * YEAR_MS - (q * YEAR_MS) / 4;
      series.push({
        date: new Date(tOld).toISOString().slice(0, 10),
        dividend: 0.25,
        adjDividend: 0.25,
      });
      const tNew = asOf.getTime() - (q * YEAR_MS) / 4;
      series.push({
        date: new Date(tNew).toISOString().slice(0, 10),
        dividend: 0.3,
        adjDividend: 0.3,
      });
    }
    const cagr = computeDividendCagr5y(series, asOf);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeGreaterThan(0.035);
    expect(cagr!).toBeLessThan(0.04);
  });
});

import { describe, it, expect } from "vitest";
import { computeR1DividendCut } from "../r1-dividend-cut";

const asOf = new Date("2026-05-29T00:00:00Z");
// A date exactly N calendar months before asOf (same day-of-month).
const monthsAgo = (n: number) => {
  const d = new Date(asOf);
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
};

const steadyDivs = [
  { date: monthsAgo(0), adjDividend: 1.0, dividend: 1.0 },
  { date: monthsAgo(3), adjDividend: 1.0, dividend: 1.0 },
];

describe("computeR1DividendCut", () => {
  it("returns 0 when no cut and no history", () => {
    const r = computeR1DividendCut({ dividends: steadyDivs, pastRiskHistory: [], asOf });
    expect(r.points).toBe(0);
    expect(r.fired).toBe(false);
  });

  it("fires 60 on a fresh cut in the dividend stream", () => {
    const r = computeR1DividendCut({
      dividends: [
        { date: monthsAgo(0), adjDividend: 0.5, dividend: 0.5 },
        { date: monthsAgo(3), adjDividend: 1.0, dividend: 1.0 },
      ],
      pastRiskHistory: [],
      asOf,
    });
    expect(r.points).toBe(60);
    expect(r.fired).toBe(true);
  });

  it("stays at 60 within 12 months of a historical cut", () => {
    const r = computeR1DividendCut({
      dividends: steadyDivs,
      pastRiskHistory: [{ date: monthsAgo(6), r1Points: 60 }],
      asOf,
    });
    expect(r.points).toBe(60);
  });

  it("decays to 50 at month 14 post-cut", () => {
    const r = computeR1DividendCut({
      dividends: steadyDivs,
      pastRiskHistory: [{ date: monthsAgo(14), r1Points: 60 }],
      asOf,
    });
    expect(r.points).toBe(50);
  });

  it("decays to 20 at month 22 post-cut", () => {
    const r = computeR1DividendCut({
      dividends: steadyDivs,
      pastRiskHistory: [{ date: monthsAgo(22), r1Points: 60 }],
      asOf,
    });
    expect(r.points).toBe(20);
  });

  it("returns 0 past the 24-month decay window", () => {
    const r = computeR1DividendCut({
      dividends: steadyDivs,
      pastRiskHistory: [{ date: monthsAgo(26), r1Points: 60 }],
      asOf,
    });
    expect(r.points).toBe(0);
  });
});

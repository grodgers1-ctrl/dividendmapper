import { describe, it, expect } from "vitest";
import { computeRiskScore } from "../compute-risk-score";

const asOf = new Date("2026-05-29T00:00:00Z");
const monthsAgo = (n: number) => {
  const d = new Date(asOf);
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
};
const daysAgo = (n: number) =>
  new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const steadyQuarters = [2.0, 2.0, 2.0, 2.0, 2.0, 2.0]
  .map((cov, i) => ({ quarter: `Q${i}`, fcf: cov, dividendsPaid: 1 }))
  .reverse();

const baseInputs = (overrides: Record<string, unknown> = {}) => ({
  symbol: "AAPL",
  r1: {
    dividends: [
      { date: monthsAgo(0), adjDividend: 1, dividend: 1 },
      { date: monthsAgo(3), adjDividend: 1, dividend: 1 },
    ],
    pastRiskHistory: [],
    asOf,
  },
  r2: { quarters: steadyQuarters },
  r3: { payoutRatio: 0.5, sector: "technology" as const },
  r4: { currentEpsAvg: 10, pastEpsHistory: [{ date: daysAgo(100), eps_avg: 10 }], asOf },
  r5: { currentNetDebtToEbitda: 2.0, yearAgoNetDebtToEbitda: 2.0 },
  r6: { currentInterestCoverage: 6, yearAgoInterestCoverage: 6 },
  r7Trades: { trades: [] },
  ...overrides,
});

describe("computeRiskScore", () => {
  it("returns 0 with full data quality for a healthy stock", () => {
    const r = computeRiskScore(baseInputs());
    expect(r.score).toBe(0);
    expect(r.dataQuality).toBe("full");
  });

  it("sums the points of firing signals", () => {
    const r = computeRiskScore(
      baseInputs({
        r3: { payoutRatio: 0.85, sector: "technology" as const }, // 20
        r5: { currentNetDebtToEbitda: 2.6, yearAgoNetDebtToEbitda: 2.0 }, // 15
      }),
    );
    expect(r.score).toBe(35);
  });

  it("caps the total at 100", () => {
    const r = computeRiskScore(
      baseInputs({
        r1: {
          dividends: [
            { date: monthsAgo(0), adjDividend: 0.5, dividend: 0.5 },
            { date: monthsAgo(3), adjDividend: 1, dividend: 1 },
          ],
          pastRiskHistory: [],
          asOf,
        }, // 60
        r2: {
          quarters: [2.0, 1.8, 1.6, 1.4, 1.2, 1.0]
            .map((cov, i) => ({ quarter: `Q${i}`, fcf: cov, dividendsPaid: 1 }))
            .reverse(),
        }, // 25
        r3: { payoutRatio: 0.85, sector: "technology" as const }, // 20
        r4: { currentEpsAvg: 8, pastEpsHistory: [{ date: daysAgo(100), eps_avg: 10 }], asOf }, // 15
      }),
    );
    expect(r.score).toBe(100);
  });

  it("passes through sparse data quality from R4 cold-start", () => {
    const r = computeRiskScore(baseInputs({ r4: { currentEpsAvg: 10, pastEpsHistory: [], asOf } }));
    expect(r.dataQuality).toBe("sparse");
  });

  it("keeps R7 gated off when no other risk signals fire", () => {
    const r = computeRiskScore(
      baseInputs({
        r7Trades: {
          trades: [
            { transactionType: "S-Sale", securitiesTransacted: 200_000, price: 50, date: daysAgo(5) },
          ],
        },
      }),
    );
    const r7 = r.signals.find((s) => s.code === "R7");
    expect(r7?.score).toBe(0);
    expect(r.score).toBe(0);
  });
});

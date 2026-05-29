import { describe, it, expect } from "vitest";
import { computeBuyScore } from "../compute-buy-score";

const baseInputs = (overrides = {}) => ({
  symbol: "AAPL",
  sector: "technology" as const,
  isUs: true,
  // Quality gate inputs
  fcfTtm: 1000,
  dividendsPaidTtm: 500,
  dividendCutInLast5Years: false,
  ebitTtm: 1000,
  interestExpenseTtm: 200,
  netIncomeTtm: 800,
  marketCapUsd: 5_000_000_000,
  // Signal inputs
  a1: { todayYield: 0.045, dailyYields: Array.from({ length: 1000 }, () => 0.03) },
  a2: { forwardPe: 15, peHistory: Array.from({ length: 60 }, () => 20) },
  a3: { intrinsic: 150, price: 100, isUs: true },
  b1: { currentPrice: 90, sma200: 100 },
  b2: { currentPrice: 90, high52w: 100 },
  b3: { rsi14: 35 },
  c1: { currentPrice: 100, targetMedian: 115 },
  c2: {
    events: Array.from({ length: 4 }, (_, i) => ({
      action: i < 3 ? "Upgrade" : "Downgrade",
      date: new Date(Date.now() - i * 86400000).toISOString(),
    })),
  },
  c3: { symbol: "AAPL", trades: [] },
  d1: { stockYield: 0.045, sectorMedianYield: 0.03 },
  d2: { nextExDivDate: new Date(Date.now() + 20 * 86400000).toISOString() },
  ...overrides,
});

describe("computeBuyScore", () => {
  it("returns NULL + failed gates when quality gate fails", () => {
    const result = computeBuyScore(baseInputs({ netIncomeTtm: -10 }));
    expect(result.score).toBeNull();
    expect(result.qualityGatePassed).toBe(false);
    expect(result.failedGates).toContain("GATE_4");
  });

  it("returns a 0-100 score on passing gates", () => {
    const result = computeBuyScore(baseInputs());
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(0);
    expect(result.score!).toBeLessThanOrEqual(100);
    expect(result.qualityGatePassed).toBe(true);
  });

  it("emits one signal record per signal (11 total) with raw_score + weight", () => {
    const result = computeBuyScore(baseInputs());
    expect(result.signals.length).toBe(11);
    const codes = result.signals.map((s) => s.code).sort();
    expect(codes).toEqual(
      ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2"].sort(),
    );
  });

  it("for .L tickers, C3 is N/A and C1/C2 weights are renormalised", () => {
    const result = computeBuyScore(
      baseInputs({ symbol: "ULVR.L", isUs: false, c3: { symbol: "ULVR.L", trades: [] } }),
    );
    const c3 = result.signals.find((s) => s.code === "C3");
    expect(c3?.score).toBeNull();
    // C1 and C2 should sum to original C-category weight redistributed
    const c1 = result.signals.find((s) => s.code === "C1");
    const c2 = result.signals.find((s) => s.code === "C2");
    expect((c1?.effectiveWeight ?? 0) + (c2?.effectiveWeight ?? 0)).toBeCloseTo(1.0, 3);
  });

  it("applies A3 soft-signal half-weight for non-US tickers", () => {
    const result = computeBuyScore(
      baseInputs({ symbol: "ULVR.L", isUs: false, a3: { intrinsic: 150, price: 100, isUs: false } }),
    );
    const a3 = result.signals.find((s) => s.code === "A3");
    // A3 base weight 0.2; soft signal halves it to 0.1, redistributing 0.1 to A1/A2
    expect(a3?.effectiveWeight).toBeCloseTo(0.1, 3);
  });

  it("returns NULL when 2+ categories collapse (insufficient_signals)", () => {
    const result = computeBuyScore(
      baseInputs({
        // Nuke A entirely
        a1: { todayYield: 0.045, dailyYields: [] }, // insufficient history
        a2: { forwardPe: -5, peHistory: [] }, // negative + insufficient
        a3: { intrinsic: 0, price: 100, isUs: true }, // intrinsic 0 → N/A
        // Nuke B entirely
        b1: { currentPrice: 0, sma200: 0 },
        b2: { currentPrice: 0, high52w: 0 },
        b3: { rsi14: -1 }, // out of range
      }),
    );
    expect(result.score).toBeNull();
    expect(result.reason).toBe("insufficient_signals");
  });
});

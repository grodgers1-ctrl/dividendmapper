import { describe, it, expect } from "vitest";
import { computeTrimScore } from "../compute-trim-score";

const baseInputs = (overrides = {}) => ({
  symbol: "AAPL",
  sector: "technology" as const,
  isUs: true,
  // Mildly overbought/expensive inputs so most Trim signals have a score.
  a1: { todayYield: 0.02, dailyYields: Array.from({ length: 1000 }, () => 0.03) },
  a2: { forwardPe: 30, peHistory: Array.from({ length: 60 }, () => 20) },
  a3: { intrinsic: 80, price: 100, isUs: true },
  b1: { currentPrice: 115, sma200: 100 },
  b2: { currentPrice: 98, high52w: 100 },
  b3: { rsi14: 72 },
  c1: { currentPrice: 100, targetMedian: 92 },
  c2: {
    events: Array.from({ length: 4 }, (_, i) => ({
      action: i < 3 ? "Downgrade" : "Upgrade",
      date: new Date(Date.now() - i * 86400000).toISOString(),
    })),
  },
  ...overrides,
});

describe("computeTrimScore", () => {
  it("returns a 0-100 score with no quality gate", () => {
    const result = computeTrimScore(baseInputs());
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(0);
    expect(result.score!).toBeLessThanOrEqual(100);
  });

  it("emits 8 signal records (3 A + 3 B + 2 C) with non-empty human labels", () => {
    const result = computeTrimScore(baseInputs());
    expect(result.signals.length).toBe(8);
    const codes = result.signals.map((s) => s.code).sort();
    expect(codes).toEqual(
      ["T-A1", "T-A2", "T-A3", "T-B1", "T-B2", "T-B3", "T-C1", "T-C2"].sort(),
    );
    // Every scored signal should carry a human label for the drawer.
    for (const s of result.signals) {
      if (s.score != null) expect(s.humanLabel.length).toBeGreaterThan(0);
    }
  });

  it("applies T-A3 soft-signal half-weight for non-US tickers", () => {
    const result = computeTrimScore(
      baseInputs({ symbol: "ULVR.L", isUs: false, a3: { intrinsic: 80, price: 100, isUs: false } }),
    );
    const a3 = result.signals.find((s) => s.code === "T-A3");
    expect(a3?.effectiveWeight).toBeCloseTo(0.1, 3);
  });

  it("renormalises within a category when one signal is N/A", () => {
    // Nuke T-C2 (thin coverage) → T-C1 should absorb the full C weight.
    const result = computeTrimScore(baseInputs({ c2: { events: [] } }));
    const c1 = result.signals.find((s) => s.code === "T-C1");
    const c2 = result.signals.find((s) => s.code === "T-C2");
    expect(c2?.score).toBeNull();
    expect(c1?.effectiveWeight).toBeCloseTo(1.0, 3);
  });

  it("returns NULL when 2+ categories collapse (insufficient_signals)", () => {
    const result = computeTrimScore(
      baseInputs({
        // Nuke A
        a1: { todayYield: 0.02, dailyYields: [] },
        a2: { forwardPe: -5, peHistory: [] },
        a3: { intrinsic: 0, price: 100, isUs: true },
        // Nuke B
        b1: { currentPrice: 0, sma200: 0 },
        b2: { currentPrice: 0, high52w: 0 },
        b3: { rsi14: -1 },
      }),
    );
    expect(result.score).toBeNull();
    expect(result.reason).toBe("insufficient_signals");
  });
});

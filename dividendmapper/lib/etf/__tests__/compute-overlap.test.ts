import { describe, it, expect } from "vitest";
import { computeOverlap } from "../compute-overlap";

describe("computeOverlap", () => {
  it("finds shared holdings and computes weights for each segment", () => {
    const a = [
      { holding_symbol: "AAPL", weight_pct: 5 },
      { holding_symbol: "MSFT", weight_pct: 4 },
      { holding_symbol: "NVDA", weight_pct: 3 },
    ];
    const b = [
      { holding_symbol: "AAPL", weight_pct: 6 },
      { holding_symbol: "MSFT", weight_pct: 5 },
      { holding_symbol: "GOOG", weight_pct: 2 },
    ];
    const o = computeOverlap(a, b);
    expect(o.sharedCount).toBe(2);
    expect(o.sharedWeightA).toBeCloseTo(9, 5); // 5+4
    expect(o.sharedWeightB).toBeCloseTo(11, 5); // 6+5
    expect(o.onlyA[0].holding_symbol).toBe("NVDA");
    expect(o.onlyB[0].holding_symbol).toBe("GOOG");
    expect(o.onlyAWeight).toBeCloseTo(3, 5);
    expect(o.onlyBWeight).toBeCloseTo(2, 5);
  });

  it("returns empty result for two empty inputs", () => {
    const o = computeOverlap([], []);
    expect(o.sharedCount).toBe(0);
    expect(o.sharedWeightA).toBe(0);
    expect(o.sharedWeightB).toBe(0);
    expect(o.onlyA).toEqual([]);
    expect(o.onlyB).toEqual([]);
  });

  it("handles full overlap (same set, different weights)", () => {
    const a = [
      { holding_symbol: "AAPL", weight_pct: 5 },
      { holding_symbol: "MSFT", weight_pct: 4 },
    ];
    const b = [
      { holding_symbol: "AAPL", weight_pct: 7 },
      { holding_symbol: "MSFT", weight_pct: 3 },
    ];
    const o = computeOverlap(a, b);
    expect(o.sharedCount).toBe(2);
    expect(o.sharedWeightA).toBeCloseTo(9, 5);
    expect(o.sharedWeightB).toBeCloseTo(10, 5);
    expect(o.onlyA).toEqual([]);
    expect(o.onlyB).toEqual([]);
    expect(o.onlyAWeight).toBe(0);
    expect(o.onlyBWeight).toBe(0);
  });

  it("handles zero overlap (disjoint sets)", () => {
    const a = [{ holding_symbol: "AAPL", weight_pct: 5 }];
    const b = [{ holding_symbol: "TSLA", weight_pct: 6 }];
    const o = computeOverlap(a, b);
    expect(o.sharedCount).toBe(0);
    expect(o.sharedWeightA).toBe(0);
    expect(o.sharedWeightB).toBe(0);
    expect(o.onlyA[0].holding_symbol).toBe("AAPL");
    expect(o.onlyB[0].holding_symbol).toBe("TSLA");
  });

  it("captures both A and B weights for each shared holding", () => {
    const a = [{ holding_symbol: "NVDA", weight_pct: 4.7 }];
    const b = [{ holding_symbol: "NVDA", weight_pct: 5.2 }];
    const o = computeOverlap(a, b);
    expect(o.shared).toHaveLength(1);
    expect(o.shared[0]).toEqual({ holding_symbol: "NVDA", a: 4.7, b: 5.2 });
  });
});

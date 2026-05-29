import { describe, it, expect } from "vitest";
import { computeC1TargetSpread } from "../c1-target-spread";

describe("computeC1TargetSpread", () => {
  it("returns 100 when median target is 30%+ above price", () => {
    expect(computeC1TargetSpread({ currentPrice: 100, targetMedian: 130 }).score).toBe(100);
  });

  it("returns 0 when median target is 30%+ below price", () => {
    expect(computeC1TargetSpread({ currentPrice: 100, targetMedian: 70 }).score).toBe(0);
  });

  it("returns 50 at parity", () => {
    expect(computeC1TargetSpread({ currentPrice: 100, targetMedian: 100 }).score).toBe(50);
  });

  it("returns 75 at +15% upside", () => {
    expect(computeC1TargetSpread({ currentPrice: 100, targetMedian: 115 }).score).toBe(75);
  });

  it("returns N/A when no consensus target available", () => {
    expect(computeC1TargetSpread({ currentPrice: 100, targetMedian: null }).score).toBeNull();
    expect(computeC1TargetSpread({ currentPrice: 100, targetMedian: 0 }).score).toBeNull();
  });
});

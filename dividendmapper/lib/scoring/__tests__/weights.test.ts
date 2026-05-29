import { describe, it, expect } from "vitest";
import { BUY_BASE_WEIGHTS, applyUserWeights } from "../weights";

describe("BUY_BASE_WEIGHTS", () => {
  it("category weights sum to 1.0", () => {
    const sum = BUY_BASE_WEIGHTS.A + BUY_BASE_WEIGHTS.B + BUY_BASE_WEIGHTS.C + BUY_BASE_WEIGHTS.D;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("applyUserWeights", () => {
  it("returns base weights when prefs are null/undecided", () => {
    const result = applyUserWeights(BUY_BASE_WEIGHTS, null);
    expect(result).toEqual(BUY_BASE_WEIGHTS);
  });

  it("income_now: shifts +5 to D, -5 from B", () => {
    const result = applyUserWeights(BUY_BASE_WEIGHTS, { primary_goal: "income_now" });
    expect(result.D).toBeCloseTo(BUY_BASE_WEIGHTS.D + 0.05, 5);
    expect(result.B).toBeCloseTo(BUY_BASE_WEIGHTS.B - 0.05, 5);
    expect(result.A).toBe(BUY_BASE_WEIGHTS.A);
    expect(result.C).toBe(BUY_BASE_WEIGHTS.C);
  });

  it("total_return: returns base weights unchanged", () => {
    const result = applyUserWeights(BUY_BASE_WEIGHTS, { primary_goal: "total_return" });
    expect(result).toEqual(BUY_BASE_WEIGHTS);
  });

  it("safety_stability: returns base category weights (gate-side tuning is separate)", () => {
    const result = applyUserWeights(BUY_BASE_WEIGHTS, { primary_goal: "safety_stability" });
    expect(result).toEqual(BUY_BASE_WEIGHTS);
  });

  it("applied weights still sum to 1.0 after income_now shift", () => {
    const result = applyUserWeights(BUY_BASE_WEIGHTS, { primary_goal: "income_now" });
    const sum = result.A + result.B + result.C + result.D;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

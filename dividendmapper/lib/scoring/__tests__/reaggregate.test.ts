import { describe, it, expect } from "vitest";
import {
  categoryWeightsFor,
  reaggregateBuyScore,
  type StoredSignal,
} from "../reaggregate";
import { BUY_BASE_WEIGHTS } from "../weights";

describe("categoryWeightsFor", () => {
  it("returns base when all undecided/null", () => {
    expect(categoryWeightsFor(null)).toEqual(BUY_BASE_WEIGHTS);
    expect(
      categoryWeightsFor({
        primary_goal: "undecided",
        investing_horizon: "undecided",
        risk_appetite: "undecided",
      }),
    ).toEqual(BUY_BASE_WEIGHTS);
  });
  it("sums to 1 after renormalise", () => {
    const w = categoryWeightsFor({
      primary_goal: "income_now",
      investing_horizon: "10y_plus",
      risk_appetite: "aggressive",
    });
    expect(w.A + w.B + w.C + w.D).toBeCloseTo(1, 6);
  });
  it("keeps every category inside the clamp band after renormalise", () => {
    const w = categoryWeightsFor({
      primary_goal: "income_now",
      risk_appetite: "cautious",
      investing_horizon: "already_retired",
    });
    const sum = w.A + w.B + w.C + w.D;
    for (const v of [w.A, w.B, w.C, w.D]) {
      expect(v).toBeGreaterThanOrEqual(0.05 / sum - 1e-9);
      expect(v).toBeLessThanOrEqual(0.55 / sum + 1e-9);
    }
  });
});

describe("reaggregateBuyScore", () => {
  // One signal per category scoring 100/50/0/100. With base weights:
  // .35*100 + .30*50 + .20*0 + .15*100 = 35 + 15 + 0 + 15 = 65
  const signals: StoredSignal[] = [
    { signal_code: "A1", raw_score: 100, weight: 1 },
    { signal_code: "B1", raw_score: 50, weight: 1 },
    { signal_code: "C1", raw_score: 0, weight: 1 },
    { signal_code: "D1", raw_score: 100, weight: 1 },
  ];
  it("reproduces a base-weighted score", () => {
    expect(reaggregateBuyScore(signals, BUY_BASE_WEIGHTS)).toBe(65);
  });
  it("drops a fully-N/A category and renormalises across the rest", () => {
    const noC = signals.filter((s) => s.signal_code !== "C1");
    // available A/B/D base weights .35/.30/.15 sum .80
    // (.35*100 + .30*50 + .15*100)/.80 = (35+15+15)/.8 = 65/.8 = 81.25 -> 81
    expect(reaggregateBuyScore(noC, BUY_BASE_WEIGHTS)).toBe(81);
  });
  it("returns null when there are no signals", () => {
    expect(reaggregateBuyScore([], BUY_BASE_WEIGHTS)).toBeNull();
  });
});

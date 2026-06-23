import { describe, it, expect } from "vitest";
import {
  pickCurrentAndBaseline,
  selectWeeklyMovers,
  PRICE_SWING_THRESHOLD,
  type HistoryRow,
  type WeeklyObservation,
} from "../weekly-digest";

function row(over: Partial<HistoryRow>): HistoryRow {
  return { observed_at: "2026-06-14", buy_score: 50, risk_score: 50, current_price: 100, ...over };
}

function obs(over: Partial<WeeklyObservation>): WeeklyObservation {
  return {
    ticker: "TST",
    currResilience: 50, baseResilience: 50,
    currRisk: 50, baseRisk: 50,
    currPrice: 100, basePrice: 100,
    dataQuality: "full",
    ...over,
  };
}

describe("pickCurrentAndBaseline", () => {
  it("takes the latest row as current and the closest row on/before the cutoff as baseline", () => {
    const rowsDesc = [
      row({ observed_at: "2026-06-14", current_price: 110 }),
      row({ observed_at: "2026-06-09", current_price: 104 }),
      row({ observed_at: "2026-06-06", current_price: 100 }), // on/before cutoff 2026-06-07
      row({ observed_at: "2026-06-01", current_price: 95 }),
    ];
    const { current, baseline } = pickCurrentAndBaseline(rowsDesc, "2026-06-07");
    expect(current!.current_price).toBe(110);
    expect(baseline!.current_price).toBe(100);
  });

  it("returns a null baseline when no row is on/before the cutoff", () => {
    const rowsDesc = [row({ observed_at: "2026-06-14" })];
    const { current, baseline } = pickCurrentAndBaseline(rowsDesc, "2026-06-07");
    expect(current).not.toBeNull();
    expect(baseline).toBeNull();
  });

  it("returns nulls for an empty history", () => {
    expect(pickCurrentAndBaseline([], "2026-06-07")).toEqual({ current: null, baseline: null });
  });
});

describe("selectWeeklyMovers", () => {
  it("includes a ticker whose resilience changed and reports the delta + direction", () => {
    const result = selectWeeklyMovers([obs({ currResilience: 55, baseResilience: 50 })]);
    expect(result.movers).toHaveLength(1);
    expect(result.movers[0].resilience).toEqual({ curr: 55, delta: 5, direction: "up" });
    expect(result.movers[0].risk).toEqual({ curr: 50, delta: 0, direction: "flat" });
    expect(result.pendingBaselineCount).toBe(0);
  });

  it("includes a ticker whose price swing is at least the threshold, scores flat", () => {
    const result = selectWeeklyMovers([obs({ currPrice: 94, basePrice: 100 })]);
    expect(result.movers).toHaveLength(1);
    expect(result.movers[0].price).toEqual({ swingPct: -6, direction: "down" });
    expect(result.movers[0].resilience).toEqual({ curr: 50, delta: 0, direction: "flat" });
  });

  it("excludes a ticker with flat scores and a sub-threshold price drift, no baseline pending", () => {
    const result = selectWeeklyMovers([obs({ currPrice: 100.3, basePrice: 100 })]);
    expect(result.movers).toEqual([]);
    expect(result.pendingBaselineCount).toBe(0);
  });

  it("excludes a fresh ticker with no baseline AND counts it in pendingBaselineCount", () => {
    const result = selectWeeklyMovers([
      obs({ baseResilience: null, baseRisk: null, basePrice: null }),
    ]);
    expect(result.movers).toEqual([]);
    expect(result.pendingBaselineCount).toBe(1);
  });

  it("does NOT count a degraded_uk ticker as pending baseline (skipped entirely)", () => {
    const result = selectWeeklyMovers([
      obs({
        dataQuality: "degraded_uk",
        baseResilience: null, baseRisk: null, basePrice: null,
        currRisk: 80, currPrice: 100,
      }),
    ]);
    expect(result.movers).toEqual([]);
    expect(result.pendingBaselineCount).toBe(0);
  });

  it("does NOT count a ticker with neither current nor baseline data", () => {
    const result = selectWeeklyMovers([
      obs({
        currResilience: null, baseResilience: null,
        currRisk: null, baseRisk: null,
        currPrice: null, basePrice: null,
      }),
    ]);
    expect(result.movers).toEqual([]);
    expect(result.pendingBaselineCount).toBe(0);
  });

  it("counts multiple pending tickers across a portfolio mix", () => {
    const result = selectWeeklyMovers([
      obs({ ticker: "STEADY", currPrice: 100.1, basePrice: 100 }),
      obs({ ticker: "MOVER", currResilience: 60, baseResilience: 50 }),
      obs({ ticker: "FRESH1", baseResilience: null, baseRisk: null, basePrice: null }),
      obs({ ticker: "FRESH2", baseResilience: null, baseRisk: null, basePrice: null }),
    ]);
    expect(result.movers.map((m) => m.ticker)).toEqual(["MOVER"]);
    expect(result.pendingBaselineCount).toBe(2);
  });

  it("never includes a degraded_uk ticker even if a metric moved", () => {
    const result = selectWeeklyMovers([
      obs({ dataQuality: "degraded_uk", currRisk: 80, baseRisk: 50, currPrice: 80, basePrice: 100 }),
    ]);
    expect(result.movers).toEqual([]);
  });

  it("rounds the price swing to one decimal place", () => {
    const result = selectWeeklyMovers([obs({ currPrice: 106.25, basePrice: 100 })]);
    expect(result.movers[0].price!.swingPct).toBe(6.3);
  });

  it("exposes the threshold constant as 5", () => {
    expect(PRICE_SWING_THRESHOLD).toBe(5);
  });
});

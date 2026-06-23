import { describe, it, expect } from "vitest";
import { computeQB2NavTrend } from "../q_b2-nav-trend";

function series(startNav: number, perQuarterPct: number, n = 12): { period_end: string; nav_per_share: number }[] {
  // Compound quarterly growth at perQuarterPct.
  const out = [];
  let nav = startNav;
  for (let i = 0; i < n; i++) {
    out.push({ period_end: `2022-Q${i}`, nav_per_share: nav });
    nav *= 1 + perQuarterPct / 100;
  }
  return out;
}

describe("computeQB2NavTrend", () => {
  it("strong positive trend (+0.6%/quarter) scores 100", () => {
    const r = computeQB2NavTrend({ navPerShareHistory: series(10, 0.7) });
    expect(r.score).toBe(100);
    expect(r.humanLabel).toMatch(/quarter/);
  });

  it("mild positive trend (+0.25%/quarter) scores 75", () => {
    expect(computeQB2NavTrend({ navPerShareHistory: series(10, 0.25) }).score).toBe(75);
  });

  it("mild negative trend (-0.25%/quarter) scores 50", () => {
    expect(computeQB2NavTrend({ navPerShareHistory: series(10, -0.25) }).score).toBe(50);
  });

  it("steep negative trend (-0.7%/quarter) scores 25", () => {
    expect(computeQB2NavTrend({ navPerShareHistory: series(10, -0.7) }).score).toBe(25);
  });

  it("collapsing NAV (-2%/quarter) scores 0", () => {
    expect(computeQB2NavTrend({ navPerShareHistory: series(10, -2) }).score).toBe(0);
  });

  it("< 8 quarters returns null", () => {
    expect(computeQB2NavTrend({ navPerShareHistory: series(10, 0.5, 5) }).score).toBeNull();
  });

  it("flat NAV scores 75 (slope = 0 falls into [0, 0.5) band)", () => {
    expect(computeQB2NavTrend({ navPerShareHistory: series(10, 0) }).score).toBe(75);
  });
});

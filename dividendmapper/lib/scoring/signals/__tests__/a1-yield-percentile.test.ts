import { describe, it, expect } from "vitest";
import { computeA1YieldPercentile } from "../a1-yield-percentile";

describe("computeA1YieldPercentile", () => {
  it("returns 100 when today's yield is the highest in 5y", () => {
    const dailyYields = Array.from({ length: 300 }, (_, i) => 0.02 + i * 0.0001);
    const result = computeA1YieldPercentile({ todayYield: 0.10, dailyYields });
    expect(result.score).toBe(100);
    expect(result.humanLabel).toMatch(/100th percentile/);
  });

  it("returns 0 when today's yield is the lowest in 5y", () => {
    const dailyYields = Array.from({ length: 300 }, (_, i) => 0.05 + i * 0.0001);
    const result = computeA1YieldPercentile({ todayYield: 0.001, dailyYields });
    expect(result.score).toBe(0);
  });

  it("returns ~50 when today's yield is the median", () => {
    const dailyYields = Array.from({ length: 300 }, (_, i) => 0.03 + i * 0.001);
    // midpoint of [0.03 .. 0.33] is 0.18
    const result = computeA1YieldPercentile({ todayYield: 0.18, dailyYields });
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.score).toBeLessThanOrEqual(55);
  });

  it("returns N/A when fewer than 250 daily yields (insufficient history)", () => {
    const result = computeA1YieldPercentile({
      todayYield: 0.05,
      dailyYields: Array.from({ length: 100 }, () => 0.04),
    });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/insufficient/i);
  });

  it("human label cites the yield + percentile", () => {
    const dailyYields = Array.from({ length: 1000 }, (_, i) => 0.02 + i * 0.0001);
    const result = computeA1YieldPercentile({ todayYield: 0.06, dailyYields });
    expect(result.humanLabel).toMatch(/yield/i);
    expect(result.humanLabel).toMatch(/percentile/i);
  });
});

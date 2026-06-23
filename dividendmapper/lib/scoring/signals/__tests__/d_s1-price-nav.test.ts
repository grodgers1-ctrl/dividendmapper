import { describe, it, expect } from "vitest";
import { computeDS1PriceNav } from "../d_s1-price-nav";

function ratioSeries(mean: number, stdev: number, n: number): number[] {
  // Symmetric series around `mean` whose sample stdev (population) is `stdev`.
  // For n samples placed at mean ± stdev (half on each side), the population
  // variance is exactly stdev² → population stdev = stdev.
  const half = n / 2;
  return Array.from({ length: n }, (_, i) =>
    i < half ? mean - stdev : mean + stdev,
  );
}

describe("computeDS1PriceNav", () => {
  it("deeply discounted (-2σ) scores 100", () => {
    const history = ratioSeries(1.0, 0.1, 100); // mean 1.0, σ 0.1
    // currentPrice / navPerShare = 0.8 → ratio = 0.8 = mean − 2σ
    const result = computeDS1PriceNav({
      currentPrice: 0.8,
      navPerShare: 1,
      ratioHistory: history,
    });
    expect(result.score).toBe(100);
    expect(result.humanLabel).toMatch(/discount/);
  });

  it("at the mean (0σ) scores 50", () => {
    const history = ratioSeries(1.0, 0.1, 100);
    const result = computeDS1PriceNav({
      currentPrice: 1.0,
      navPerShare: 1,
      ratioHistory: history,
    });
    expect(result.score).toBe(50);
    expect(result.humanLabel).toMatch(/fair/);
  });

  it("premium (+2σ) scores 0", () => {
    const history = ratioSeries(1.0, 0.1, 100);
    const result = computeDS1PriceNav({
      currentPrice: 1.2,
      navPerShare: 1,
      ratioHistory: history,
    });
    expect(result.score).toBe(0);
    expect(result.humanLabel).toMatch(/premium/);
  });

  it("navPerShare ≤ 0 returns null (data error)", () => {
    const result = computeDS1PriceNav({
      currentPrice: 10,
      navPerShare: 0,
      ratioHistory: ratioSeries(1.0, 0.1, 100),
    });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/NAV/i);
  });

  it("insufficient history (< 60 observations) returns neutral 50", () => {
    const result = computeDS1PriceNav({
      currentPrice: 10,
      navPerShare: 5,
      ratioHistory: [1.0, 1.1, 1.2],
    });
    expect(result.score).toBe(50);
    expect(result.humanLabel).toMatch(/insufficient/i);
  });

  it("zero-dispersion history returns neutral 50", () => {
    const result = computeDS1PriceNav({
      currentPrice: 1,
      navPerShare: 1,
      ratioHistory: Array.from({ length: 100 }, () => 1.0),
    });
    expect(result.score).toBe(50);
    expect(result.humanLabel).toMatch(/dispersion/i);
  });
});

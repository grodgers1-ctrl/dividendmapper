import { describe, it, expect } from "vitest";
import { computeB1Below200dMa } from "../b1-below-200d-ma";

describe("computeB1Below200dMa", () => {
  it("returns 100 when price is 30%+ below the 200d MA", () => {
    const result = computeB1Below200dMa({ currentPrice: 70, sma200: 100 });
    expect(result.score).toBe(100);
  });

  it("returns 0 when price is 30%+ above the 200d MA", () => {
    const result = computeB1Below200dMa({ currentPrice: 130, sma200: 100 });
    expect(result.score).toBe(0);
  });

  it("returns 50 when price equals the 200d MA", () => {
    const result = computeB1Below200dMa({ currentPrice: 100, sma200: 100 });
    expect(result.score).toBe(50);
  });

  it("returns 75 when price is 15% below the 200d MA", () => {
    const result = computeB1Below200dMa({ currentPrice: 85, sma200: 100 });
    expect(result.score).toBe(75);
  });

  it("returns N/A when sma200 <= 0 (insufficient history)", () => {
    const result = computeB1Below200dMa({ currentPrice: 100, sma200: 0 });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/insufficient/i);
  });
});

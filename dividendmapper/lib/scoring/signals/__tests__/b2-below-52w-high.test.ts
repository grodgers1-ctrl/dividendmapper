import { describe, it, expect } from "vitest";
import { computeB2Below52wHigh } from "../b2-below-52w-high";

describe("computeB2Below52wHigh", () => {
  it("returns 0 at the 52w high", () => {
    const result = computeB2Below52wHigh({ currentPrice: 100, high52w: 100 });
    expect(result.score).toBe(0);
  });

  it("returns 100 when 30%+ below the 52w high", () => {
    const result = computeB2Below52wHigh({ currentPrice: 70, high52w: 100 });
    expect(result.score).toBe(100);
  });

  it("returns 50 when 15% below the 52w high", () => {
    const result = computeB2Below52wHigh({ currentPrice: 85, high52w: 100 });
    expect(result.score).toBe(50);
  });

  it("returns 0 when at or above the 52w high", () => {
    const result = computeB2Below52wHigh({ currentPrice: 110, high52w: 100 });
    expect(result.score).toBe(0);
    expect(result.humanLabel).toMatch(/at or above/i);
  });

  it("returns N/A when high52w <= 0", () => {
    const result = computeB2Below52wHigh({ currentPrice: 100, high52w: 0 });
    expect(result.score).toBeNull();
  });
});

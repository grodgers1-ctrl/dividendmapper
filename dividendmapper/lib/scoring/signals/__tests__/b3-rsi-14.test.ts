import { describe, it, expect } from "vitest";
import { computeB3Rsi14 } from "../b3-rsi-14";

describe("computeB3Rsi14", () => {
  it("returns 100 at RSI 0 and labels it oversold", () => {
    const result = computeB3Rsi14({ rsi14: 0 });
    expect(result.score).toBe(100);
    expect(result.humanLabel).toMatch(/oversold/i);
  });

  it("returns 75 at RSI 25", () => {
    expect(computeB3Rsi14({ rsi14: 25 }).score).toBe(75);
  });

  it("returns 50 at RSI 50 and labels it neutral", () => {
    const result = computeB3Rsi14({ rsi14: 50 });
    expect(result.score).toBe(50);
    expect(result.humanLabel).toMatch(/neutral/i);
  });

  it("returns 0 at RSI 100 and labels it overbought", () => {
    const result = computeB3Rsi14({ rsi14: 100 });
    expect(result.score).toBe(0);
    expect(result.humanLabel).toMatch(/overbought/i);
  });

  it("returns N/A when RSI is out of range", () => {
    expect(computeB3Rsi14({ rsi14: -1 }).score).toBeNull();
    expect(computeB3Rsi14({ rsi14: 101 }).score).toBeNull();
  });
});

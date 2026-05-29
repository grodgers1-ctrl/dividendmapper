import { describe, it, expect } from "vitest";
import { computeTrimB1, computeTrimB2, computeTrimB3 } from "../trim-b-signals";

describe("computeTrimB1 (inverted B1)", () => {
  it("scores 100 when price is well above the 200d MA", () => {
    // price 30% above MA → Buy B1 = 0 → Trim = 100
    expect(computeTrimB1({ currentPrice: 130, sma200: 100 }).score).toBe(100);
  });

  it("passes through N/A when the 200d MA is unavailable", () => {
    expect(computeTrimB1({ currentPrice: 100, sma200: 0 }).score).toBeNull();
  });
});

describe("computeTrimB2 (inverted B2)", () => {
  it("scores 100 when price is at the 52w high", () => {
    // at high → Buy B2 = 0 → Trim = 100
    expect(computeTrimB2({ currentPrice: 100, high52w: 100 }).score).toBe(100);
  });
});

describe("computeTrimB3 (inverted B3)", () => {
  it("scores high when RSI is overbought (RSI 80 → 80)", () => {
    // Buy B3 = 100 - 80 = 20 → Trim = 100 - 20 = 80
    expect(computeTrimB3({ rsi14: 80 }).score).toBe(80);
  });

  it("passes through N/A when RSI is out of range", () => {
    expect(computeTrimB3({ rsi14: -1 }).score).toBeNull();
  });
});

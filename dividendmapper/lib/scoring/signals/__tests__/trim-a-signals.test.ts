import { describe, it, expect } from "vitest";
import { computeTrimA1, computeTrimA2, computeTrimA3 } from "../trim-a-signals";

describe("computeTrimA1 (inverted A1)", () => {
  it("scores 0 when yield is at the top of its 5y range (overbought = don't trim... wait, high yield = cheap)", () => {
    const dailyYields = Array.from({ length: 1000 }, () => 0.03);
    // todayYield well above range → Buy A1 = 100 → Trim = 0
    expect(computeTrimA1({ todayYield: 0.1, dailyYields }).score).toBe(0);
  });

  it("scores 100 when yield is at the bottom of its 5y range", () => {
    const dailyYields = Array.from({ length: 1000 }, () => 0.03);
    // todayYield below range → Buy A1 = 0 → Trim = 100
    expect(computeTrimA1({ todayYield: 0.001, dailyYields }).score).toBe(100);
  });

  it("passes through N/A when history is insufficient", () => {
    expect(computeTrimA1({ todayYield: 0.05, dailyYields: [] }).score).toBeNull();
  });
});

describe("computeTrimA2 (inverted A2)", () => {
  it("scores 100 when forward P/E is well above the 5y average", () => {
    expect(
      computeTrimA2({ forwardPe: 40, peHistory: Array.from({ length: 60 }, () => 20) }).score,
    ).toBe(100);
  });

  it("passes through N/A when forward P/E is non-positive", () => {
    expect(
      computeTrimA2({ forwardPe: -5, peHistory: Array.from({ length: 60 }, () => 20) }).score,
    ).toBeNull();
  });
});

describe("computeTrimA3 (inverted A3)", () => {
  it("scores 100 when DCF intrinsic is well below price, preserving softSignal=false for US", () => {
    const r = computeTrimA3({ intrinsic: 50, price: 100, isUs: true });
    expect(r.score).toBe(100);
    expect(r.softSignal).toBe(false);
  });

  it("preserves softSignal=true for non-US tickers, even on N/A", () => {
    const r = computeTrimA3({ intrinsic: 0, price: 100, isUs: false });
    expect(r.score).toBeNull();
    expect(r.softSignal).toBe(true);
  });
});

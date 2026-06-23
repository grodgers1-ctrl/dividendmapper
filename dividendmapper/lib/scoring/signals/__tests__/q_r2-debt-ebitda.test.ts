import { describe, it, expect } from "vitest";
import { computeQR2DebtEbitda } from "../q_r2-debt-ebitda";

describe("computeQR2DebtEbitda", () => {
  it("≤ 4× scores 100", () => {
    const r = computeQR2DebtEbitda({ totalDebt: 350, cash: 50, ttmEbitda: 100 });
    expect(r.score).toBe(100);
    expect(r.humanLabel).toMatch(/3\.0×/);
  });

  it("4-6× scores 75", () => {
    expect(computeQR2DebtEbitda({ totalDebt: 550, cash: 50, ttmEbitda: 100 }).score).toBe(75);
  });

  it("6-8× scores 50", () => {
    expect(computeQR2DebtEbitda({ totalDebt: 750, cash: 50, ttmEbitda: 100 }).score).toBe(50);
  });

  it("8-10× scores 25", () => {
    expect(computeQR2DebtEbitda({ totalDebt: 950, cash: 50, ttmEbitda: 100 }).score).toBe(25);
  });

  it("> 10× scores 0", () => {
    expect(computeQR2DebtEbitda({ totalDebt: 1200, cash: 50, ttmEbitda: 100 }).score).toBe(0);
  });

  it("net cash position scores 100", () => {
    expect(computeQR2DebtEbitda({ totalDebt: 50, cash: 100, ttmEbitda: 100 }).score).toBe(100);
  });

  it("non-positive EBITDA returns null", () => {
    expect(computeQR2DebtEbitda({ totalDebt: 100, cash: 0, ttmEbitda: 0 }).score).toBeNull();
  });
});

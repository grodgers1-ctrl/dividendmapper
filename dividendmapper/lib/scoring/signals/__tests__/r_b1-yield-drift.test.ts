import { describe, it, expect } from "vitest";
import { computeRB1YieldDrift } from "../r_b1-yield-drift";

describe("computeRB1YieldDrift", () => {
  it("|Δ| ≤ 1pp scores 100", () => {
    // current yield 10%, prior 9.5% → 0.5pp drift
    const r = computeRB1YieldDrift({
      currentInterestIncome: 100,
      currentDebtInvestments: 1000,
      priorInterestIncome: 95,
      priorDebtInvestments: 1000,
    });
    expect(r.score).toBe(100);
  });

  it("|Δ| in 1-2pp scores 75", () => {
    // 10% vs 8.5% → 1.5pp
    const r = computeRB1YieldDrift({
      currentInterestIncome: 100,
      currentDebtInvestments: 1000,
      priorInterestIncome: 85,
      priorDebtInvestments: 1000,
    });
    expect(r.score).toBe(75);
  });

  it("|Δ| in 2-3pp scores 50", () => {
    // 10% vs 7.5% → 2.5pp
    const r = computeRB1YieldDrift({
      currentInterestIncome: 100,
      currentDebtInvestments: 1000,
      priorInterestIncome: 75,
      priorDebtInvestments: 1000,
    });
    expect(r.score).toBe(50);
  });

  it("|Δ| > 4pp scores 0 (symmetric — drop)", () => {
    // 5% vs 10% → 5pp downward drift
    const r = computeRB1YieldDrift({
      currentInterestIncome: 50,
      currentDebtInvestments: 1000,
      priorInterestIncome: 100,
      priorDebtInvestments: 1000,
    });
    expect(r.score).toBe(0);
    expect(r.humanLabel).toMatch(/−/);
  });

  it("|Δ| > 4pp scores 0 (symmetric — spike)", () => {
    // 15% vs 10% → 5pp upward drift (PIK / non-accrual surge)
    const r = computeRB1YieldDrift({
      currentInterestIncome: 150,
      currentDebtInvestments: 1000,
      priorInterestIncome: 100,
      priorDebtInvestments: 1000,
    });
    expect(r.score).toBe(0);
    expect(r.humanLabel).toMatch(/\+/);
  });

  it("zero debt investments returns null", () => {
    const r = computeRB1YieldDrift({
      currentInterestIncome: 100,
      currentDebtInvestments: 0,
      priorInterestIncome: 100,
      priorDebtInvestments: 1000,
    });
    expect(r.score).toBeNull();
  });
});

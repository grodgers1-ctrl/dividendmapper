import { describe, it, expect } from "vitest";
import { computeRR1IntCoverage, interestCoverageRatio } from "../r_r1-int-coverage";

describe("computeRR1IntCoverage", () => {
  it("< 2.5× scores 0 (high risk)", () => {
    const r = computeRR1IntCoverage({ ttmEbitda: 200, ttmInterestExpense: 100 });
    expect(r.score).toBe(0);
    expect(r.humanLabel).toMatch(/2\.0×/);
  });

  it("2.5-4× scores 50", () => {
    expect(computeRR1IntCoverage({ ttmEbitda: 300, ttmInterestExpense: 100 }).score).toBe(50);
  });

  it("> 4× scores 100", () => {
    expect(computeRR1IntCoverage({ ttmEbitda: 500, ttmInterestExpense: 100 }).score).toBe(100);
  });

  it("zero / negative interest expense returns null", () => {
    expect(computeRR1IntCoverage({ ttmEbitda: 500, ttmInterestExpense: 0 }).score).toBeNull();
    expect(computeRR1IntCoverage({ ttmEbitda: 500, ttmInterestExpense: -10 }).score).toBeNull();
  });

  it("non-positive EBITDA scores 0 (cannot cover at all)", () => {
    expect(computeRR1IntCoverage({ ttmEbitda: -10, ttmInterestExpense: 100 }).score).toBe(0);
  });

  it("interestCoverageRatio helper returns ratio or null", () => {
    expect(interestCoverageRatio(400, 100)).toBe(4);
    expect(interestCoverageRatio(400, 0)).toBeNull();
  });
});

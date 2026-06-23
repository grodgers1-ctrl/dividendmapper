import { describe, it, expect } from "vitest";
import { computeRU1IntCoverage } from "../r_u1-int-coverage";

describe("computeRU1IntCoverage", () => {
  it("< 2.0× coverage scores 0 (UK gearing convention breached)", () => {
    expect(computeRU1IntCoverage({ ttmEbitda: 150, ttmInterestExpense: 100 }).score).toBe(0);
  });

  it("2.0-3.5× coverage scores 50", () => {
    expect(computeRU1IntCoverage({ ttmEbitda: 300, ttmInterestExpense: 100 }).score).toBe(50);
  });

  it("> 3.5× coverage scores 100", () => {
    expect(computeRU1IntCoverage({ ttmEbitda: 500, ttmInterestExpense: 100 }).score).toBe(100);
  });

  it("zero/negative interest expense returns null", () => {
    expect(computeRU1IntCoverage({ ttmEbitda: 500, ttmInterestExpense: 0 }).score).toBeNull();
  });

  it("non-positive EBITDA scores 0", () => {
    expect(computeRU1IntCoverage({ ttmEbitda: -10, ttmInterestExpense: 100 }).score).toBe(0);
  });
});

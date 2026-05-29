import { describe, it, expect } from "vitest";
import { reinvestScore } from "../score";

describe("reinvestScore", () => {
  it("uses a neutral income contribution (50) when portfolio income is unknown", () => {
    // 0.6 * 80 + 0.4 * 50 = 48 + 20 = 68
    expect(
      reinvestScore({ candidateBuyScore: 80, projectedAddedAnnualDivGbp: 100, totalPortfolioIncomeGbp: 0 }),
    ).toBe(68);
  });

  it("blends 60% buy score with 40% income contribution", () => {
    // ratio 100/1000 = 0.1 → income contribution 50 + 50*0.1 = 55
    // 0.6 * 80 + 0.4 * 55 = 48 + 22 = 70
    expect(
      reinvestScore({ candidateBuyScore: 80, projectedAddedAnnualDivGbp: 100, totalPortfolioIncomeGbp: 1000 }),
    ).toBe(70);
  });

  it("clamps the income contribution at 100", () => {
    // huge projected income → contribution clamps to 100 → 0.6*80 + 0.4*100 = 88
    expect(
      reinvestScore({ candidateBuyScore: 80, projectedAddedAnnualDivGbp: 5000, totalPortfolioIncomeGbp: 1000 }),
    ).toBe(88);
  });
});

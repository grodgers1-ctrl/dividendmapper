import { describe, it, expect } from "vitest";
import { computeR6InterestCoverageDecline } from "../r6-interest-coverage-decline";

describe("computeR6InterestCoverageDecline", () => {
  it("fires 15 on a steep (>=40%) YoY coverage decline", () => {
    expect(
      computeR6InterestCoverageDecline({ currentInterestCoverage: 3, yearAgoInterestCoverage: 6 }).points,
    ).toBe(15);
  });

  it("fires 10 on a moderate (20-40%) YoY coverage decline", () => {
    expect(
      computeR6InterestCoverageDecline({ currentInterestCoverage: 4.5, yearAgoInterestCoverage: 6 }).points,
    ).toBe(10);
  });

  it("fires 10 when coverage crosses below 3x without a steep delta", () => {
    expect(
      computeR6InterestCoverageDecline({ currentInterestCoverage: 2.9, yearAgoInterestCoverage: 3.2 }).points,
    ).toBe(10);
  });

  it("returns 0 when coverage is stable", () => {
    expect(
      computeR6InterestCoverageDecline({ currentInterestCoverage: 6, yearAgoInterestCoverage: 6 }).points,
    ).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { computeR5DebtAcceleration } from "../r5-debt-acceleration";

describe("computeR5DebtAcceleration", () => {
  it("fires 15 on a steep (>=30%) YoY leverage increase", () => {
    expect(
      computeR5DebtAcceleration({ currentNetDebtToEbitda: 2.6, yearAgoNetDebtToEbitda: 2.0 }).points,
    ).toBe(15);
  });

  it("fires 10 on a moderate (15-30%) YoY leverage increase", () => {
    expect(
      computeR5DebtAcceleration({ currentNetDebtToEbitda: 2.4, yearAgoNetDebtToEbitda: 2.0 }).points,
    ).toBe(10);
  });

  it("returns 0 when leverage is stable", () => {
    expect(
      computeR5DebtAcceleration({ currentNetDebtToEbitda: 2.0, yearAgoNetDebtToEbitda: 2.0 }).points,
    ).toBe(0);
  });

  it("returns 0 when prior leverage is non-positive (net cash)", () => {
    expect(
      computeR5DebtAcceleration({ currentNetDebtToEbitda: 1.0, yearAgoNetDebtToEbitda: -0.5 }).points,
    ).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { computeQU2Ltv } from "../q_u2-ltv";

describe("computeQU2Ltv", () => {
  it("≤ 25% LTV scores 100", () => {
    expect(computeQU2Ltv({ totalDebt: 200, totalAssets: 1000 }).score).toBe(100);
  });

  it("25-35% LTV scores 75", () => {
    expect(computeQU2Ltv({ totalDebt: 300, totalAssets: 1000 }).score).toBe(75);
  });

  it("35-45% LTV scores 50", () => {
    expect(computeQU2Ltv({ totalDebt: 400, totalAssets: 1000 }).score).toBe(50);
  });

  it("45-55% LTV scores 25", () => {
    expect(computeQU2Ltv({ totalDebt: 500, totalAssets: 1000 }).score).toBe(25);
  });

  it("> 55% LTV scores 0", () => {
    expect(computeQU2Ltv({ totalDebt: 600, totalAssets: 1000 }).score).toBe(0);
  });

  it("zero assets returns null", () => {
    expect(computeQU2Ltv({ totalDebt: 200, totalAssets: 0 }).score).toBeNull();
  });
});

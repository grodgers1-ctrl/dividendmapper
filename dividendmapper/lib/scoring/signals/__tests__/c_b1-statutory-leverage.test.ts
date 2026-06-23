import { describe, it, expect } from "vitest";
import { computeCB1StatutoryLeverage } from "../c_b1-statutory-leverage";

describe("computeCB1StatutoryLeverage", () => {
  it("≤ 1.0× scores 100", () => {
    expect(computeCB1StatutoryLeverage({ totalDebt: 800, totalEquity: 1000 }).score).toBe(100);
  });

  it("1.0-1.3× scores 75", () => {
    expect(computeCB1StatutoryLeverage({ totalDebt: 1200, totalEquity: 1000 }).score).toBe(75);
  });

  it("1.3-1.5× scores 50 (warning zone)", () => {
    expect(computeCB1StatutoryLeverage({ totalDebt: 1400, totalEquity: 1000 }).score).toBe(50);
  });

  it("1.5-1.8× scores 25", () => {
    expect(computeCB1StatutoryLeverage({ totalDebt: 1700, totalEquity: 1000 }).score).toBe(25);
  });

  it("> 1.8× scores 0 (approaching cap)", () => {
    expect(computeCB1StatutoryLeverage({ totalDebt: 1900, totalEquity: 1000 }).score).toBe(0);
  });

  it("non-positive equity returns null", () => {
    expect(computeCB1StatutoryLeverage({ totalDebt: 100, totalEquity: 0 }).score).toBeNull();
  });
});

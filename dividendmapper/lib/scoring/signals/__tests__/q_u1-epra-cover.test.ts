import { describe, it, expect } from "vitest";
import { computeQU1EpraCover } from "../q_u1-epra-cover";

describe("computeQU1EpraCover", () => {
  it("≥ 1.20× cover scores 100", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: 130, ttmTotalDividendsPaid: 100 }).score).toBe(100);
  });

  it("1.10-1.20× cover scores 75", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: 115, ttmTotalDividendsPaid: 100 }).score).toBe(75);
  });

  it("1.00-1.10× cover scores 50", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: 105, ttmTotalDividendsPaid: 100 }).score).toBe(50);
  });

  it("0.90-1.00× cover scores 25 (under-cover)", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: 95, ttmTotalDividendsPaid: 100 }).score).toBe(25);
  });

  it("< 0.90× cover scores 0", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: 80, ttmTotalDividendsPaid: 100 }).score).toBe(0);
  });

  it("zero dividends returns null", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: 100, ttmTotalDividendsPaid: 0 }).score).toBeNull();
  });

  it("non-positive rental income scores 0", () => {
    expect(computeQU1EpraCover({ ttmNetRentalIncome: -10, ttmTotalDividendsPaid: 100 }).score).toBe(0);
  });
});

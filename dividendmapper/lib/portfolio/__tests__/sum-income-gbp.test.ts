import { describe, it, expect } from "vitest";
import { sumIncomeGbp, type IncomeCurrencyTotal } from "@/lib/portfolio/income";

describe("sumIncomeGbp", () => {
  it("returns 0 for an empty totals list", () => {
    expect(sumIncomeGbp([], {})).toBe(0);
  });

  it("returns the GBP total unchanged when the only currency is GBP", () => {
    const totals: IncomeCurrencyTotal[] = [{ currency: "GBP", total: 1234.5 }];
    expect(sumIncomeGbp(totals, { GBP: 1 })).toBe(1234.5);
  });

  it("converts USD totals via the provided rate", () => {
    const totals: IncomeCurrencyTotal[] = [{ currency: "USD", total: 1000 }];
    // 1 USD = 0.78 GBP → £780
    expect(sumIncomeGbp(totals, { USD: 0.78 })).toBe(780);
  });

  it("sums mixed currencies after conversion", () => {
    const totals: IncomeCurrencyTotal[] = [
      { currency: "GBP", total: 500 },
      { currency: "USD", total: 1000 },
      { currency: "EUR", total: 200 },
    ];
    const rates = { GBP: 1, USD: 0.78, EUR: 0.85 };
    // 500 + 780 + 170 = 1450
    expect(sumIncomeGbp(totals, rates)).toBe(1450);
  });

  it("omits currencies missing from the rates map", () => {
    const totals: IncomeCurrencyTotal[] = [
      { currency: "GBP", total: 500 },
      { currency: "ZWL", total: 9999 }, // unsupported, no rate
    ];
    expect(sumIncomeGbp(totals, { GBP: 1 })).toBe(500);
  });

  it("omits currencies with non-finite or non-positive rates", () => {
    const totals: IncomeCurrencyTotal[] = [
      { currency: "GBP", total: 500 },
      { currency: "USD", total: 1000 },
      { currency: "EUR", total: 200 },
    ];
    const rates = { GBP: 1, USD: Number.NaN, EUR: 0 };
    expect(sumIncomeGbp(totals, rates)).toBe(500);
  });

  it("handles GBp (pence) via the 0.01 multiplier", () => {
    const totals: IncomeCurrencyTotal[] = [{ currency: "GBp", total: 12_345 }];
    expect(sumIncomeGbp(totals, { GBp: 0.01 })).toBe(123.45);
  });
});

import { describe, it, expect } from "vitest";
import { computeNetDividend } from "../dividend-tax";

describe("computeNetDividend", () => {
  it("returns gross for sheltered UK wrappers (ISA, SIPP)", () => {
    const isa = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "isa",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(isa).toEqual({ net: 100, taxApplied: 0 });

    const sipp = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "sipp",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(sipp).toEqual({ net: 100, taxApplied: 0 });
  });

  it("returns gross for sheltered US wrappers (401k, ira, roth_ira)", () => {
    for (const wrapper of ["401k", "ira", "roth_ira"] as const) {
      const result = computeNetDividend({
        grossPrimaryCurrency: 100,
        wrapper,
        locale: "us",
        ytdGrossInTaxableSoFar: 0,
      });
      expect(result).toEqual({ net: 100, taxApplied: 0 });
    }
  });

  it("UK GIA: first £500 YTD untaxed, remainder at 8.75%", () => {
    const under = computeNetDividend({
      grossPrimaryCurrency: 200,
      wrapper: "gia",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(under).toEqual({ net: 200, taxApplied: 0 });

    const straddle = computeNetDividend({
      grossPrimaryCurrency: 400,
      wrapper: "gia",
      locale: "uk",
      ytdGrossInTaxableSoFar: 300,
    });
    expect(straddle.taxApplied).toBeCloseTo(200 * 0.0875, 4);
    expect(straddle.net).toBeCloseTo(400 - 200 * 0.0875, 4);

    const above = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "gia",
      locale: "uk",
      ytdGrossInTaxableSoFar: 1000,
    });
    expect(above.taxApplied).toBeCloseTo(100 * 0.0875, 4);
    expect(above.net).toBeCloseTo(100 - 100 * 0.0875, 4);
  });

  it("US Brokerage: flat 15% qualified-dividend rate, no allowance", () => {
    const result = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "brokerage",
      locale: "us",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(result.taxApplied).toBeCloseTo(15, 4);
    expect(result.net).toBeCloseTo(85, 4);
  });

  it("returns gross unchanged when grossPrimaryCurrency is 0 or negative", () => {
    expect(
      computeNetDividend({ grossPrimaryCurrency: 0, wrapper: "gia", locale: "uk", ytdGrossInTaxableSoFar: 0 }),
    ).toEqual({ net: 0, taxApplied: 0 });
    expect(
      computeNetDividend({ grossPrimaryCurrency: -10, wrapper: "gia", locale: "uk", ytdGrossInTaxableSoFar: 0 }),
    ).toEqual({ net: -10, taxApplied: 0 });
  });

  it("UK wrapper enum value 'brokerage' is treated as GIA for legacy rows", () => {
    const result = computeNetDividend({
      grossPrimaryCurrency: 1000,
      wrapper: "brokerage",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(result.taxApplied).toBeCloseTo(500 * 0.0875, 4);
    expect(result.net).toBeCloseTo(1000 - 500 * 0.0875, 4);
  });
});

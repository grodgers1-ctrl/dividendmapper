import { describe, it, expect } from "vitest";
import { aggregatePortfolioIncome, type ActualIncome } from "@/lib/portfolio/income";
import type { QuoteResult } from "@/lib/market/quote";

function quote(ticker: string, dividend: number, currency: string): QuoteResult {
  return {
    ok: true,
    cached: false,
    data: {
      ticker,
      source: "FMP",
      price: null,
      dividend,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency,
      exchange: currency === "GBP" ? "LSE" : "US",
      name: null,
      fetchedAt: new Date(0).toISOString(),
    },
  };
}

const holding = (ticker: string, wrapper: string, quantity = 10) => ({ ticker, quantity, wrapper });

describe("aggregatePortfolioIncome — estimate preference (forward run-rate)", () => {
  it("is unchanged when no actuals are supplied (estimate path)", () => {
    const out = aggregatePortfolioIncome(
      [holding("VOD.L", "isa")],
      new Map([["VOD.L", quote("VOD.L", 0.5, "GBP")]]),
    );
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ wrapper: "isa", currency: "GBP", annualIncome: 5, source: "estimate" });
  });

  it("prefers the FMP estimate over a (possibly partial-year) actual", () => {
    const actuals = new Map<string, ActualIncome>([["VOD.L::isa", { amount: 42, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("VOD.L", "isa")],
      new Map([["VOD.L", quote("VOD.L", 0.5, "GBP")]]), // estimate is 5
      actuals,
    );
    expect(out.rows[0]).toMatchObject({ annualIncome: 5, source: "estimate" });
  });

  it("falls back to the actual ONLY when there is no estimate quote", () => {
    const actuals = new Map<string, ActualIncome>([["BME.L::isa", { amount: 49.22, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("BME.L", "isa")],
      new Map(), // no quote -> no estimate
      actuals,
    );
    expect(out.rows[0]).toMatchObject({ annualIncome: 49.22, source: "actual" });
  });

  it("marks a bucket 'mixed' when it blends an estimate and an estimate-less actual fallback", () => {
    const actuals = new Map<string, ActualIncome>([["BME.L::isa", { amount: 30, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("BME.L", "isa"), holding("ULVR.L", "isa")],
      new Map([
        // BME.L: no quote -> actual fallback (30)
        ["ULVR.L", quote("ULVR.L", 1, "GBP")], // estimate 10
      ]),
      actuals,
    );
    const isaGbp = out.rows.find((r) => r.key === "isa:GBP");
    expect(isaGbp).toMatchObject({ annualIncome: 40, holdingsCount: 2, source: "mixed" });
  });

  it("uses the USD estimate for a US stock even when a GBP actual exists", () => {
    // A US stock in an ISA: actual dividends arrive in GBP (account ccy), but the
    // /yr column is the forward estimate, so it lands in the USD bucket.
    const actuals = new Map<string, ActualIncome>([["AAPL::isa", { amount: 12, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("AAPL", "isa"), holding("MSFT", "isa")],
      new Map([
        ["AAPL", quote("AAPL", 1, "USD")], // estimate 10 USD — preferred over the GBP actual
        ["MSFT", quote("MSFT", 2, "USD")], // estimate 20 USD
      ]),
      actuals,
    );
    expect(out.rows.find((r) => r.key === "isa:GBP")).toBeUndefined();
    expect(out.rows.find((r) => r.key === "isa:USD")).toMatchObject({ annualIncome: 30, source: "estimate" });
  });
});

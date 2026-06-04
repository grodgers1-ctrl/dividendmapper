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

describe("aggregatePortfolioIncome — actuals preference", () => {
  it("is unchanged when no actuals are supplied (estimate path)", () => {
    const out = aggregatePortfolioIncome(
      [holding("VOD.L", "isa")],
      new Map([["VOD.L", quote("VOD.L", 0.5, "GBP")]]),
    );
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ wrapper: "isa", currency: "GBP", annualIncome: 5, source: "estimate" });
  });

  it("prefers the actual TTM sum over the quantity×dps estimate and labels the row 'actual'", () => {
    const actuals = new Map<string, ActualIncome>([["VOD.L::isa", { amount: 42, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("VOD.L", "isa")],
      new Map([["VOD.L", quote("VOD.L", 0.5, "GBP")]]), // estimate would be 5
      actuals,
    );
    expect(out.rows[0]).toMatchObject({ annualIncome: 42, source: "actual" });
  });

  it("falls back to the estimate when the actual is missing or zero", () => {
    const actuals = new Map<string, ActualIncome>([["VOD.L::isa", { amount: 0, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("VOD.L", "isa")],
      new Map([["VOD.L", quote("VOD.L", 0.5, "GBP")]]),
      actuals,
    );
    expect(out.rows[0]).toMatchObject({ annualIncome: 5, source: "estimate" });
  });

  it("marks a bucket 'mixed' when it blends actual and estimated holdings", () => {
    const actuals = new Map<string, ActualIncome>([["VOD.L::isa", { amount: 30, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("VOD.L", "isa"), holding("ULVR.L", "isa")],
      new Map([
        ["VOD.L", quote("VOD.L", 0.5, "GBP")],
        ["ULVR.L", quote("ULVR.L", 1, "GBP")], // estimate 10
      ]),
      actuals,
    );
    const isaGbp = out.rows.find((r) => r.key === "isa:GBP");
    expect(isaGbp).toMatchObject({ annualIncome: 40, holdingsCount: 2, source: "mixed" });
  });

  it("buckets an actual by its own currency (account ccy GBP), separate from a USD estimate", () => {
    // A US stock in an ISA: actual dividends arrive in GBP (account ccy), but the
    // FMP estimate would be in USD — they must land in different buckets.
    const actuals = new Map<string, ActualIncome>([["AAPL::isa", { amount: 12, currency: "GBP" }]]);
    const out = aggregatePortfolioIncome(
      [holding("AAPL", "isa"), holding("MSFT", "isa")],
      new Map([
        ["AAPL", quote("AAPL", 1, "USD")], // would-be estimate, ignored in favour of actual
        ["MSFT", quote("MSFT", 2, "USD")], // estimate 20 USD
      ]),
      actuals,
    );
    expect(out.rows.find((r) => r.key === "isa:GBP")).toMatchObject({ annualIncome: 12, source: "actual" });
    expect(out.rows.find((r) => r.key === "isa:USD")).toMatchObject({ annualIncome: 20, source: "estimate" });
  });
});

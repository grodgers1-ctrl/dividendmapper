import { describe, it, expect } from "vitest";
import { resolveRowIncome } from "@/lib/portfolio/row-income";
import type { QuoteResult } from "@/lib/market/quote";

function okQuote(dividend: number | null, currency: string): QuoteResult {
  return {
    ok: true,
    cached: false,
    data: {
      ticker: "X",
      source: "FMP",
      price: null,
      dividend,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency,
      exchange: null,
      name: null,
      fetchedAt: "2026-06-04T00:00:00Z",
    },
  };
}

const row = (ticker: string, quantity: number, wrapper = "isa") => ({ ticker, quantity, wrapper });

describe("resolveRowIncome", () => {
  it("prefers the actual synced dividend over the estimate", () => {
    const r = resolveRowIncome(row("TW.L", 100), { "TW.L": okQuote(0.05, "GBP") }, { "TW.L::isa": { amount: 110.54, currency: "GBP" } });
    expect(r).toEqual({ kind: "ok", amount: 110.54, currency: "GBP", source: "actual" });
  });

  it("falls back to the quantity×dps estimate when there's no actual", () => {
    const r = resolveRowIncome(row("MSFT", 10), { MSFT: okQuote(3.56, "USD") });
    expect(r).toEqual({ kind: "ok", amount: 35.6, currency: "USD", source: "estimate" });
  });

  it("reports failed when the quote failed and there's no actual", () => {
    const r = resolveRowIncome(row("MSFT", 10), { MSFT: { ok: false, error: "polygon_snapshot_429", status: 429 } });
    expect(r).toEqual({ kind: "failed" });
  });

  it("reports no_data when the quote has no dividend and there's no actual", () => {
    const r = resolveRowIncome(row("QS", 10), { QS: okQuote(null, "USD") });
    expect(r).toEqual({ kind: "no_data" });
  });

  it("uses the actual even when the quote is missing entirely (synced LSE, no live quote)", () => {
    const r = resolveRowIncome(row("BME.L", 50), {}, { "BME.L::isa": { amount: 49.22, currency: "GBP" } });
    expect(r).toEqual({ kind: "ok", amount: 49.22, currency: "GBP", source: "actual" });
  });

  it("matches actuals on wrapper too (same ticker, different wrapper)", () => {
    const r = resolveRowIncome(row("VOD.L", 100, "gia"), {}, { "VOD.L::isa": { amount: 20, currency: "GBP" } });
    expect(r.kind).toBe("failed"); // no gia actual, no quote
  });
});

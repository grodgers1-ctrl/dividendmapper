import { describe, it, expect } from "vitest";
import { resolveRowValue, scoringPrice } from "@/lib/portfolio/row-value";

const row = (ticker: string, quantity: number | string) => ({ ticker, quantity });

describe("scoringPrice", () => {
  it("passes a US price through as USD", () => {
    expect(scoringPrice("MSFT", 400)).toEqual({ price: 400, currency: "USD" });
  });

  it("converts an LSE price from pence (GBX) to GBP (÷100)", () => {
    // W7L.L current_price is stored in pence, like dividend_per_share.
    expect(scoringPrice("W7L.L", 450)).toEqual({ price: 4.5, currency: "GBP" });
  });

  it("returns null for a null or non-positive price", () => {
    expect(scoringPrice("MSFT", null)).toBeNull();
    expect(scoringPrice("MSFT", 0)).toBeNull();
    expect(scoringPrice("W7L.L", -1)).toBeNull();
  });
});

describe("resolveRowValue", () => {
  it("computes quantity × price in the price's currency", () => {
    const r = resolveRowValue(row("MSFT", 10), { MSFT: { price: 400, currency: "USD" } });
    expect(r).toEqual({ kind: "ok", amount: 4000, currency: "USD" });
  });

  it("computes a GBP value for an LSE holding (price already converted)", () => {
    const r = resolveRowValue(row("W7L.L", 390), { "W7L.L": { price: 4.5, currency: "GBP" } });
    expect(r).toEqual({ kind: "ok", amount: 1755, currency: "GBP" });
  });

  it("handles a string quantity (DB numeric comes back as a string)", () => {
    const r = resolveRowValue(row("AAPL", "5"), { AAPL: { price: 200, currency: "USD" } });
    expect(r).toEqual({ kind: "ok", amount: 1000, currency: "USD" });
  });

  it("returns no_data when the ticker has no price (not yet scored)", () => {
    expect(resolveRowValue(row("NEW", 10), {})).toEqual({ kind: "no_data" });
  });

  it("returns no_data for a zero or negative price", () => {
    expect(resolveRowValue(row("MSFT", 10), { MSFT: { price: 0, currency: "USD" } })).toEqual({ kind: "no_data" });
  });
});

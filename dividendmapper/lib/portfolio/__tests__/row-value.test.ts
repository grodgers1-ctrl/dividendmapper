import { describe, it, expect } from "vitest";
import { resolveRowValue } from "@/lib/portfolio/row-value";

// scoringPrice unit-test coverage lives in row-value.currency.test.ts. It
// got a breaking signature change (now returns a plain number, takes an
// args object) when we made it currency-aware. The null/zero/negative guard
// moved up to the callsite in load-priced-holdings.ts.

const row = (ticker: string, quantity: number | string) => ({ ticker, quantity });

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

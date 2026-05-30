import { describe, it, expect } from "vitest";
import type { QuoteResult } from "@/lib/market/quote";
import { isUkTicker, ukDividendQuote, mergeUkDividends } from "../uk-income";

describe("isUkTicker", () => {
  it("matches .L suffix case-insensitively", () => {
    expect(isUkTicker("LGEN.L")).toBe(true);
    expect(isUkTicker("lgen.l")).toBe(true);
    expect(isUkTicker("SCHD")).toBe(false);
    expect(isUkTicker("PEP")).toBe(false);
  });
});

describe("ukDividendQuote", () => {
  it("converts pence (GBX) dividend_per_share to a GBP dividend quote", () => {
    const q = ukDividendQuote("LGEN.L", 15.67);
    expect(q).not.toBeNull();
    expect(q!.ok).toBe(true);
    if (q!.ok) {
      expect(q!.data.dividend).toBeCloseTo(0.1567, 6);
      expect(q!.data.currency).toBe("GBP");
      expect(q!.data.source).toBe("FMP");
    }
  });

  it("returns null when there is no usable dividend", () => {
    expect(ukDividendQuote("LGEN.L", null)).toBeNull();
    expect(ukDividendQuote("LGEN.L", 0)).toBeNull();
  });
});

function okQuote(dividend: number | null, currency: string): QuoteResult {
  return {
    ok: true,
    cached: false,
    data: {
      ticker: "X",
      source: "Polygon",
      price: null,
      dividend,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency,
      exchange: null,
      name: null,
      fetchedAt: "2026-05-30T00:00:00Z",
    },
  };
}

describe("mergeUkDividends", () => {
  it("patches a UK ticker whose quote has no dividend, using scoring data", () => {
    const quotes = new Map<string, QuoteResult>([
      ["LGEN.L", { ok: false, error: "ticker_not_found", status: 404 }],
    ]);
    const merged = mergeUkDividends(quotes, ["LGEN.L"], new Map([["LGEN.L", 15.67]]));
    const q = merged.get("LGEN.L");
    expect(q?.ok).toBe(true);
    if (q?.ok) {
      expect(q.data.dividend).toBeCloseTo(0.1567, 6);
      expect(q.data.currency).toBe("GBP");
    }
  });

  it("does not override a UK quote that already supplies a dividend", () => {
    const quotes = new Map<string, QuoteResult>([["VOD.L", okQuote(0.09, "GBP")]]);
    const merged = mergeUkDividends(quotes, ["VOD.L"], new Map([["VOD.L", 5.0]]));
    const q = merged.get("VOD.L");
    if (q?.ok) expect(q.data.dividend).toBe(0.09); // unchanged
  });

  it("leaves US tickers untouched", () => {
    const quotes = new Map<string, QuoteResult>([["SCHD", okQuote(null, "USD")]]);
    const merged = mergeUkDividends(quotes, ["SCHD"], new Map([["SCHD", 99]]));
    const q = merged.get("SCHD");
    if (q?.ok) expect(q.data.dividend).toBeNull(); // not patched
  });

  it("leaves a UK ticker missing when there is no scoring dividend (e.g. just added)", () => {
    const quotes = new Map<string, QuoteResult>([
      ["NEW.L", { ok: false, error: "ticker_not_found", status: 404 }],
    ]);
    const merged = mergeUkDividends(quotes, ["NEW.L"], new Map());
    expect(merged.get("NEW.L")?.ok).toBe(false); // unchanged
  });

  it("does not mutate the input map", () => {
    const quotes = new Map<string, QuoteResult>([
      ["LGEN.L", { ok: false, error: "x", status: 404 }],
    ]);
    mergeUkDividends(quotes, ["LGEN.L"], new Map([["LGEN.L", 15.67]]));
    expect(quotes.get("LGEN.L")?.ok).toBe(false);
  });
});

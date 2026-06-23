import { describe, it, expect } from "vitest";
import type { QuoteResult } from "@/lib/market/quote";
import {
  isUkTicker,
  ukDividendQuote,
  mergeUkDividends,
  scoringDividendQuote,
  mergeScoringDividends,
} from "../uk-income";

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

describe("scoringDividendQuote", () => {
  it("treats LSE values as pence (÷100, GBP)", () => {
    const q = scoringDividendQuote("LGEN.L", 21.79);
    expect(q?.ok).toBe(true);
    if (q?.ok) {
      expect(q.data.dividend).toBeCloseTo(0.2179, 6);
      expect(q.data.currency).toBe("GBP");
    }
  });

  it("treats US values as already in USD (no conversion)", () => {
    const q = scoringDividendQuote("MSFT", 3.56);
    expect(q?.ok).toBe(true);
    if (q?.ok) {
      expect(q.data.dividend).toBe(3.56);
      expect(q.data.currency).toBe("USD");
    }
  });

  it("returns null when there is no usable dividend", () => {
    expect(scoringDividendQuote("MSFT", null)).toBeNull();
    expect(scoringDividendQuote("MSFT", 0)).toBeNull();
  });
});

describe("mergeScoringDividends", () => {
  it("patches a US ticker whose live quote failed (Polygon 429), from FMP scoring data", () => {
    const quotes = new Map<string, QuoteResult>([
      ["MSFT", { ok: false, error: "polygon_snapshot_429", status: 429 }],
    ]);
    const merged = mergeScoringDividends(quotes, ["MSFT"], new Map([["MSFT", 3.56]]));
    const q = merged.get("MSFT");
    expect(q?.ok).toBe(true);
    if (q?.ok) {
      expect(q.data.dividend).toBe(3.56);
      expect(q.data.currency).toBe("USD");
    }
  });

  it("lets FMP scoring data win even over a present live dividend (FMP is the source)", () => {
    const quotes = new Map<string, QuoteResult>([["MSFT", okQuote(3.0, "USD")]]);
    const merged = mergeScoringDividends(quotes, ["MSFT"], new Map([["MSFT", 3.56]]));
    const q = merged.get("MSFT");
    if (q?.ok) expect(q.data.dividend).toBe(3.56);
  });

  it("patches LSE tickers as pence too", () => {
    const quotes = new Map<string, QuoteResult>([
      ["VOD.L", { ok: false, error: "eodhd_unconfigured", status: 503 }],
    ]);
    const merged = mergeScoringDividends(quotes, ["VOD.L"], new Map([["VOD.L", 3.9054]]));
    const q = merged.get("VOD.L");
    if (q?.ok) {
      expect(q.data.dividend).toBeCloseTo(0.039054, 6);
      expect(q.data.currency).toBe("GBP");
    }
  });

  it("keeps the live quote when there is no scoring datum yet (just-added ticker)", () => {
    const quotes = new Map<string, QuoteResult>([["NEW", okQuote(1.23, "USD")]]);
    const merged = mergeScoringDividends(quotes, ["NEW"], new Map());
    const q = merged.get("NEW");
    if (q?.ok) expect(q.data.dividend).toBe(1.23);
  });

  it("does not mutate the input map", () => {
    const quotes = new Map<string, QuoteResult>([["MSFT", okQuote(null, "USD")]]);
    mergeScoringDividends(quotes, ["MSFT"], new Map([["MSFT", 3.56]]));
    const q = quotes.get("MSFT");
    if (q?.ok) expect(q.data.dividend).toBeNull();
  });

  it("preserves the live quote's price when overlaying the scoring dividend (US)", () => {
    const liveQuote: QuoteResult = {
      ok: true,
      cached: false,
      data: {
        ticker: "AAPL",
        source: "FMP",
        price: 297.01,
        dividend: 1.0,
        dividendYield: null,
        dividendGrowth3yr: null,
        currency: "USD",
        exchange: "NASDAQ",
        name: "Apple Inc.",
        fetchedAt: "2026-06-23T00:00:00Z",
      },
    };
    const quotes = new Map<string, QuoteResult>([["AAPL", liveQuote]]);
    const merged = mergeScoringDividends(quotes, ["AAPL"], new Map([["AAPL", 1.05]]));
    const q = merged.get("AAPL");
    expect(q?.ok).toBe(true);
    if (q?.ok) {
      expect(q.data.price).toBe(297.01);
      expect(q.data.dividend).toBe(1.05);
      expect(q.data.currency).toBe("USD");
      expect(q.data.exchange).toBe("NASDAQ");
      expect(q.data.name).toBe("Apple Inc.");
    }
  });

  it("preserves the live quote's price when overlaying the scoring dividend (UK, pence)", () => {
    // Live UK quote is post-normalisation (price in £, currency 'GBP') per
    // fetchFmpQuote in lib/market/quote.ts. Scoring DPS comes in pence.
    const liveQuote: QuoteResult = {
      ok: true,
      cached: false,
      data: {
        ticker: "ULVR.L",
        source: "FMP",
        price: 44.045,
        dividend: 1.5,
        dividendYield: null,
        dividendGrowth3yr: null,
        currency: "GBP",
        exchange: "LSE",
        name: "Unilever PLC",
        fetchedAt: "2026-06-23T00:00:00Z",
      },
    };
    const quotes = new Map<string, QuoteResult>([["ULVR.L", liveQuote]]);
    const merged = mergeScoringDividends(quotes, ["ULVR.L"], new Map([["ULVR.L", 159.42]]));
    const q = merged.get("ULVR.L");
    expect(q?.ok).toBe(true);
    if (q?.ok) {
      expect(q.data.price).toBe(44.045);
      expect(q.data.dividend).toBeCloseTo(1.5942, 6); // 159.42 pence → £1.5942
      expect(q.data.currency).toBe("GBP");
      expect(q.data.exchange).toBe("LSE");
    }
  });
});

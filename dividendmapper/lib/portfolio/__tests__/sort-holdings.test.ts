import { describe, it, expect } from "vitest";
import { sortHoldings, type SortableHolding } from "@/lib/portfolio/sort-holdings";
import type { QuoteResult } from "@/lib/market/quote";

function row(ticker: string, over: Partial<SortableHolding> = {}): SortableHolding {
  return { ticker, quantity: 10, wrapper: "isa", created_at: "2026-01-01T00:00:00Z", ...over };
}

function quote(dividend: number, currency = "USD"): QuoteResult {
  return {
    ok: true,
    cached: false,
    data: { ticker: "X", source: "FMP", price: null, dividend, dividendYield: null, dividendGrowth3yr: null, currency, exchange: null, name: null, fetchedAt: "2026-01-01" },
  };
}

const tickers = (rows: SortableHolding[]) => rows.map((r) => r.ticker);

describe("sortHoldings", () => {
  const rows = [row("MSFT"), row("AAPL"), row("TSCO")];

  it("sorts by ticker A–Z", () => {
    expect(tickers(sortHoldings(rows, "ticker", {}))).toEqual(["AAPL", "MSFT", "TSCO"]);
  });

  it("sorts by value descending, unpriced holdings last", () => {
    const out = sortHoldings(rows, "value", {
      priceByTicker: {
        MSFT: { price: 400, currency: "USD" }, // 4000
        AAPL: { price: 200, currency: "USD" }, // 2000
        // TSCO unpriced -> last
      },
    });
    expect(tickers(out)).toEqual(["MSFT", "AAPL", "TSCO"]);
  });

  it("sorts by income descending", () => {
    const out = sortHoldings(rows, "income", {
      quotes: { MSFT: quote(1), AAPL: quote(5), TSCO: quote(3) }, // 10, 50, 30
    });
    expect(tickers(out)).toEqual(["AAPL", "TSCO", "MSFT"]);
  });

  it("sorts by quality score descending, null scores last", () => {
    const out = sortHoldings(rows, "score", {
      buyScoreByTicker: { MSFT: 80, AAPL: 95 }, // TSCO null -> last
    });
    expect(tickers(out)).toEqual(["AAPL", "MSFT", "TSCO"]);
  });

  it("sorts by date added, newest first", () => {
    const dated = [
      row("OLD", { created_at: "2025-01-01T00:00:00Z" }),
      row("NEW", { created_at: "2026-06-01T00:00:00Z" }),
      row("MID", { created_at: "2025-09-01T00:00:00Z" }),
    ];
    expect(tickers(sortHoldings(dated, "date", {}))).toEqual(["NEW", "MID", "OLD"]);
  });

  it("sorts by wrapper, then ticker within a wrapper", () => {
    const mixed = [
      row("ZZZ", { wrapper: "isa" }),
      row("AAA", { wrapper: "sipp" }),
      row("BBB", { wrapper: "isa" }),
    ];
    expect(tickers(sortHoldings(mixed, "wrapper", {}))).toEqual(["BBB", "ZZZ", "AAA"]);
  });

  it("does not mutate the input array", () => {
    const input = [row("B"), row("A")];
    sortHoldings(input, "ticker", {});
    expect(tickers(input)).toEqual(["B", "A"]);
  });
});

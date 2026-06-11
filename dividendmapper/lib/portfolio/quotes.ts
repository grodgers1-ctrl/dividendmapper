import "server-only";
import { fetchQuote, type QuoteResult } from "@/lib/market/quote";
import { mapWithConcurrency } from "@/lib/portfolio/map-concurrent";

// Cap parallel upstream calls. The quote path is FMP-primary now and FMP Pro
// throttles on bursts (~750/min); a Promise.all over every holding could 429.
const QUOTE_CONCURRENCY = 6;

// Parallel quote fetch for every unique ticker in a holdings list.
//
// The shared lib/market/quote.ts 15-min in-memory cache deduplicates within a
// function instance; this helper additionally dedupes the input list so a
// ticker held in two wrappers only costs one upstream call even on a cache
// miss.
//
// Returns a Map keyed by raw ticker string (matching `holdings.ticker`). Map
// values are the full QuoteResult discriminated union so callers can
// distinguish "no dividend data" (ok=true, dividend=null — e.g. LSE on the
// current EODHD tier) from "lookup failed" (ok=false — network or
// ticker_not_found).

interface HoldingTicker {
  ticker: string;
}

export async function fetchPortfolioQuotes<T extends HoldingTicker>(
  holdings: ReadonlyArray<T>,
): Promise<Map<string, QuoteResult>> {
  const uniqueTickers = Array.from(new Set(holdings.map((h) => h.ticker)));
  if (uniqueTickers.length === 0) return new Map();

  const results = await mapWithConcurrency(
    uniqueTickers,
    QUOTE_CONCURRENCY,
    async (ticker) => [ticker, await fetchQuote(ticker)] as const,
  );
  return new Map(results);
}

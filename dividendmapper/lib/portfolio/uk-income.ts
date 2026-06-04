import type { QuoteResult } from "@/lib/market/quote";

// Phase 2.75: UK (LSE) income fallback.
//
// The market quote path (lib/market/quote.ts) routed `.L` tickers to EODHD,
// which was cancelled when FMP took over scoring (2026-05-29) — so LSE holdings
// lost their income figure. FMP already pulls LSE dividends nightly into
// equity_score_history.dividend_per_share, so we reuse that here.
//
// Units: LSE quotes (and FMP's LSE dividends) are in pence (GBX). The income
// view displays £, so we divide by 100. US tickers keep the working Polygon
// quote untouched.

export function isUkTicker(ticker: string): boolean {
  return ticker.toUpperCase().endsWith(".L");
}

// Build a dividend-only quote from a scoring-table dividend_per_share (pence).
// price/yield stay null — the income consumers only read dividend + currency.
export function ukDividendQuote(
  ticker: string,
  dividendPerShareGbx: number | null,
): QuoteResult | null {
  if (
    dividendPerShareGbx === null ||
    dividendPerShareGbx === undefined ||
    dividendPerShareGbx <= 0
  ) {
    return null;
  }
  return {
    ok: true,
    cached: false,
    data: {
      ticker,
      source: "FMP",
      price: null,
      dividend: dividendPerShareGbx / 100,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency: "GBP",
      exchange: "LSE",
      name: null,
      fetchedAt: new Date(0).toISOString(),
    },
  };
}

// Returns a new quotes Map with UK tickers patched from scoring dividends where
// the live quote didn't already supply one. Pure — never mutates the input.
export function mergeUkDividends(
  quotes: ReadonlyMap<string, QuoteResult>,
  tickers: ReadonlyArray<string>,
  dividendByTicker: ReadonlyMap<string, number>,
): Map<string, QuoteResult> {
  const out = new Map(quotes);
  for (const ticker of tickers) {
    if (!isUkTicker(ticker)) continue;
    const existing = out.get(ticker);
    const alreadyHasDividend =
      existing?.ok &&
      existing.data.dividend !== null &&
      existing.data.dividend > 0;
    if (alreadyHasDividend) continue;
    const synth = ukDividendQuote(ticker, dividendByTicker.get(ticker) ?? null);
    if (synth) out.set(ticker, synth);
  }
  return out;
}

// Build a dividend-only quote from a scoring-table dividend_per_share for ANY
// ticker. LSE (.L) values are pence (GBX) → ÷100, GBP; everything else (the
// scored US universe) is already in USD. Mirrors ukDividendQuote, US-aware.
export function scoringDividendQuote(
  ticker: string,
  dividendPerShare: number | null,
): QuoteResult | null {
  if (isUkTicker(ticker)) return ukDividendQuote(ticker, dividendPerShare);
  if (
    dividendPerShare === null ||
    dividendPerShare === undefined ||
    dividendPerShare <= 0
  ) {
    return null;
  }
  return {
    ok: true,
    cached: false,
    data: {
      ticker,
      source: "FMP",
      price: null,
      dividend: dividendPerShare,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency: "USD",
      exchange: null,
      name: null,
      fetchedAt: new Date(0).toISOString(),
    },
  };
}

// FMP is our dividend source. The live quote path (Polygon for US, EODHD for
// LSE) is rate-limited / retired, so for income we prefer the nightly
// FMP-sourced equity_score_history.dividend_per_share for EVERY scored holding,
// US and LSE alike. Scoring data WINS where present (income then matches the
// scores the user already sees, and a Polygon 429 can't drop a holding); the
// live quote is kept only for tickers not yet scored. Pure — never mutates.
export function mergeScoringDividends(
  quotes: ReadonlyMap<string, QuoteResult>,
  tickers: ReadonlyArray<string>,
  dividendByTicker: ReadonlyMap<string, number>,
): Map<string, QuoteResult> {
  const out = new Map(quotes);
  for (const ticker of tickers) {
    const scoringDps = dividendByTicker.get(ticker);
    if (scoringDps == null) continue; // no FMP datum yet → keep the live quote
    const synth = scoringDividendQuote(ticker, scoringDps);
    if (synth) out.set(ticker, synth);
  }
  return out;
}

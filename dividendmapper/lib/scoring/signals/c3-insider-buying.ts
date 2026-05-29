// Buy C3 — Net insider buying (USD) over the last 90 days. Insiders buying with
// their own money is a bullish conviction signal. Map: +$5M net buying → 100;
// 0 → 50; -$5M net selling → 0. FMP insider-trading is US Form 4 only, so UK
// (.L) listings always return N/A per the spec's degradation matrix.

import type { SignalResult } from "./a1-yield-percentile";

export interface InsiderTrade {
  transactionType: string; // "P-Purchase", "S-Sale", etc.
  securitiesTransacted: number;
  price: number;
  date: string;
}

export interface C3Inputs {
  symbol: string; // used to short-circuit .L tickers
  trades: InsiderTrade[];
  asOf?: Date;
}

const WINDOW_DAYS = 90;

export function computeC3InsiderBuying(inputs: C3Inputs): SignalResult {
  // FMP insider-trading is US Form 4 only. UK tickers always N/A.
  if (/\.L$/i.test(inputs.symbol)) {
    return { score: null, humanLabel: "Insider data not available for UK listings" };
  }
  const now = inputs.asOf ?? new Date();
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = inputs.trades.filter((t) => new Date(t.date) >= cutoff);

  let netUsd = 0;
  for (const t of recent) {
    const usd = t.securitiesTransacted * t.price;
    if (/Purchase/i.test(t.transactionType)) netUsd += usd;
    else if (/Sale/i.test(t.transactionType)) netUsd -= usd;
  }
  // Map: +$5M net buying → 100, 0 → 50, -$5M net selling → 0
  const raw = 50 + (netUsd / 5_000_000) * 50;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const direction = netUsd >= 0 ? "buying" : "selling";
  return {
    score,
    humanLabel: `Net insider ${direction} $${Math.abs(netUsd / 1_000_000).toFixed(1)}M in 90d`,
  };
}

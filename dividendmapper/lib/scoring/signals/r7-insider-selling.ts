// R7 — net insider selling (USD, 90d). A confirming signal only: it ONLY fires
// when R1-R6 already total >= 5pts, so insider selling can't drive risk on its
// own. UK (.L) listings always 0 (FMP insider data is US Form 4 only).

import type { InsiderTrade } from "./c3-insider-buying";

export interface R7Inputs {
  symbol: string;
  trades: InsiderTrade[];
  precedingRiskPoints: number;
  asOf?: Date;
}

export interface R7Result {
  points: number;
  fired: boolean;
  reason: string;
}

export function computeR7InsiderSelling(inputs: R7Inputs): R7Result {
  if (/\.L$/i.test(inputs.symbol)) {
    return { points: 0, fired: false, reason: "No insider data for UK listings" };
  }
  if (inputs.precedingRiskPoints < 5) {
    return { points: 0, fired: false, reason: "Gate: no other risk signals firing" };
  }
  const now = inputs.asOf ?? new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recent = inputs.trades.filter((t) => new Date(t.date) >= cutoff);
  let netUsd = 0;
  for (const t of recent) {
    const usd = t.securitiesTransacted * t.price;
    if (/Sale/i.test(t.transactionType)) netUsd += usd;
    else if (/Purchase/i.test(t.transactionType)) netUsd -= usd;
  }
  if (netUsd >= 5_000_000) return { points: 10, fired: true, reason: `Net insider selling $${(netUsd / 1e6).toFixed(1)}M in 90d` };
  if (netUsd >= 1_000_000) return { points: 5, fired: true, reason: `Net insider selling $${(netUsd / 1e6).toFixed(1)}M in 90d` };
  return { points: 0, fired: false, reason: "Material insider selling not detected" };
}

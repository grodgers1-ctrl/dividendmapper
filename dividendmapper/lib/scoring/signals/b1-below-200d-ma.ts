// Buy B1 — Price relative to the 200-day simple moving average. Trading below
// the long-term trend line is a value/mean-reversion signal for income holdings.
// Map: 30%+ below MA → 100; at MA → 50; 30%+ above MA → 0; linear in between.

import type { SignalResult } from "./a1-yield-percentile";

export interface B1Inputs {
  currentPrice: number;
  sma200: number;
}

export function computeB1Below200dMa(inputs: B1Inputs): SignalResult {
  if (inputs.sma200 <= 0 || inputs.currentPrice <= 0) {
    return { score: null, humanLabel: "Insufficient price history (200d MA unavailable)" };
  }
  const pctBelow = ((inputs.sma200 - inputs.currentPrice) / inputs.sma200) * 100;
  // -30% → 0, 0% → 50, +30% → 100
  const raw = 50 + (pctBelow / 30) * 50;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const sign = pctBelow >= 0 ? "below" : "above";
  return {
    score,
    humanLabel: `Price ${Math.abs(pctBelow).toFixed(1)}% ${sign} 200d MA`,
  };
}

// Buy C1 — Spread between the median analyst price target and current price.
// More implied upside = more bullish. Map: +30% upside → 100; 0 → 50;
// -30% → 0; linear in between.

import type { SignalResult } from "./a1-yield-percentile";

export interface C1Inputs {
  currentPrice: number;
  targetMedian: number | null;
}

export function computeC1TargetSpread(inputs: C1Inputs): SignalResult {
  if (inputs.targetMedian == null || inputs.targetMedian <= 0 || inputs.currentPrice <= 0) {
    return { score: null, humanLabel: "No analyst price-target consensus available" };
  }
  const spreadPct = ((inputs.targetMedian - inputs.currentPrice) / inputs.currentPrice) * 100;
  // -30% → 0, 0% → 50, +30% → 100
  const raw = 50 + (spreadPct / 30) * 50;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const direction = spreadPct >= 0 ? "above" : "below";
  return {
    score,
    humanLabel: `Median analyst target ${Math.abs(spreadPct).toFixed(0)}% ${direction} current price`,
  };
}

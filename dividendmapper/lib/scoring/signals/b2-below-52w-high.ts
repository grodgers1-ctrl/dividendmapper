// Buy B2 — Price relative to the rolling 52-week (252-trading-day) high.
// Further below the high = more "on sale". Map: at high → 0; 30%+ below → 100;
// linear in between. At or above the high pins to 0.

import type { SignalResult } from "./a1-yield-percentile";

export interface B2Inputs {
  currentPrice: number;
  high52w: number;
}

export function computeB2Below52wHigh(inputs: B2Inputs): SignalResult {
  if (inputs.high52w <= 0 || inputs.currentPrice <= 0) {
    return { score: null, humanLabel: "52w high unavailable" };
  }
  const pctBelow = ((inputs.high52w - inputs.currentPrice) / inputs.high52w) * 100;
  if (pctBelow < 0) {
    return { score: 0, humanLabel: "At or above 52w high" };
  }
  const score = Math.min(100, Math.round((pctBelow / 30) * 100));
  return { score, humanLabel: `${pctBelow.toFixed(1)}% below 52w high` };
}

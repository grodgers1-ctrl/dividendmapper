// Buy B3 — 14-day RSI oversold bias. Low RSI (oversold) is bullish for a
// mean-reversion entry. Inverse-linear map: RSI 0 → 100, RSI 100 → 0.

import type { SignalResult } from "./a1-yield-percentile";

export interface B3Inputs {
  rsi14: number;
}

export function computeB3Rsi14(inputs: B3Inputs): SignalResult {
  if (inputs.rsi14 < 0 || inputs.rsi14 > 100) {
    return { score: null, humanLabel: "RSI out of range" };
  }
  // Inverse linear: 0 → 100, 100 → 0
  const score = Math.round(100 - inputs.rsi14);
  return {
    score,
    humanLabel: `RSI-14 ${inputs.rsi14.toFixed(0)} (${inputs.rsi14 < 30 ? "oversold" : inputs.rsi14 > 70 ? "overbought" : "neutral"})`,
  };
}

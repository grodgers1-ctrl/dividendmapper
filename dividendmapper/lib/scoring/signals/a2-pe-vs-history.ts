// Buy A2 — Forward P/E vs 5y historical P/E average. Lower forward P/E vs
// history = better value = higher score. Score scales linearly from
// avg/2 → 100 to 2*avg → 0.

import type { SignalResult } from "./a1-yield-percentile";

export interface A2Inputs {
  forwardPe: number;
  peHistory: number[];   // monthly P/E snapshots over the last 5 years
}

const MIN_HISTORY_MONTHS = 12;

export function computeA2PeVsHistory(inputs: A2Inputs): SignalResult {
  if (inputs.forwardPe <= 0) {
    return { score: null, humanLabel: "Forward P/E not meaningful (negative EPS)" };
  }
  if (inputs.peHistory.length < MIN_HISTORY_MONTHS) {
    return { score: null, humanLabel: "Insufficient P/E history" };
  }
  const avg = inputs.peHistory.reduce((a, b) => a + b, 0) / inputs.peHistory.length;
  const ratio = inputs.forwardPe / avg;
  let score: number;
  if (ratio <= 0.5) score = 100;
  else if (ratio >= 2) score = 0;
  else if (ratio <= 1) score = Math.round(100 - (ratio - 0.5) * 100);
  else score = Math.round(50 - (ratio - 1) * 50);
  return {
    score: Math.max(0, Math.min(100, score)),
    humanLabel: `Forward P/E ${inputs.forwardPe.toFixed(1)} vs 5y avg ${avg.toFixed(1)}`,
  };
}

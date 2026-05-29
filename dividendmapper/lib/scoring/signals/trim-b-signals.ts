// Trim category B — technical, inverted relative to Buy B. Price extended above
// trend / near the 52w high / overbought RSI all argue for trimming, so each
// Trim B signal is the sign-inverse of its Buy B sibling. (T-B2 carries a lower
// composer weight than Buy B2 because momentum often persists — handled in
// compute-trim-score, not here.)

import type { SignalResult } from "./a1-yield-percentile";
import { computeB1Below200dMa, type B1Inputs } from "./b1-below-200d-ma";
import { computeB2Below52wHigh, type B2Inputs } from "./b2-below-52w-high";
import { computeB3Rsi14, type B3Inputs } from "./b3-rsi-14";

export function computeTrimB1(inputs: B1Inputs): SignalResult {
  const buy = computeB1Below200dMa(inputs);
  if (buy.score == null) return buy;
  return { score: 100 - buy.score, humanLabel: `Price above 200d MA` };
}

export function computeTrimB2(inputs: B2Inputs): SignalResult {
  const buy = computeB2Below52wHigh(inputs);
  if (buy.score == null) return buy;
  // For T-B2, low Buy score (close to 52w high) = high Trim score
  return { score: 100 - buy.score, humanLabel: `Close to 52w high` };
}

export function computeTrimB3(inputs: B3Inputs): SignalResult {
  const buy = computeB3Rsi14(inputs);
  if (buy.score == null) return buy;
  return { score: 100 - buy.score, humanLabel: `RSI-14 overbought tilt` };
}

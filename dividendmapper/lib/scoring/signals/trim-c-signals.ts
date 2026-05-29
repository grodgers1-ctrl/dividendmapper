// Trim category C — sentiment, inverted relative to Buy C. Analyst targets below
// price and net downgrades argue for trimming. Insider selling is deliberately
// excluded here — per spec it only counts toward the Risk score (R7), not Trim.

import type { SignalResult } from "./a1-yield-percentile";
import { computeC1TargetSpread, type C1Inputs } from "./c1-target-spread";
import { computeC2NetUpgrades, type C2Inputs } from "./c2-net-upgrades";

export function computeTrimC1(inputs: C1Inputs): SignalResult {
  const buy = computeC1TargetSpread(inputs);
  if (buy.score == null) return buy;
  return { score: 100 - buy.score, humanLabel: `Median analyst target below current price` };
}

export function computeTrimC2(inputs: C2Inputs): SignalResult {
  const buy = computeC2NetUpgrades(inputs);
  if (buy.score == null) return buy;
  return { score: 100 - buy.score, humanLabel: `Net downgrades vs upgrades, 90d` };
}

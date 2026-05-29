// Phase 2.75 Risk Score orchestrator. Additive (not weighted-average like Buy/
// Trim): R1-R6 each contribute their points, then R7 (insider selling) only
// fires if R1-R6 already total >= 5. Final score is capped at 100. data_quality
// is "sparse" while R4's 90-day cold-start window is still warming up.

import { computeR1DividendCut, type R1Inputs } from "./signals/r1-dividend-cut";
import { computeR2CoverageDeterioration, type R2Inputs } from "./signals/r2-coverage-deterioration";
import { computeR3PayoutRatioBreach, type R3Inputs } from "./signals/r3-payout-ratio-breach";
import { computeR4EarningsRevisions, type R4Inputs } from "./signals/r4-earnings-revisions";
import { computeR5DebtAcceleration, type R5Inputs } from "./signals/r5-debt-acceleration";
import { computeR6InterestCoverageDecline, type R6Inputs } from "./signals/r6-interest-coverage-decline";
import { computeR7InsiderSelling } from "./signals/r7-insider-selling";
import type { InsiderTrade } from "./signals/c3-insider-buying";
import type { SignalRecord } from "./compute-buy-score";

export interface ComputeRiskScoreInputs {
  symbol: string;
  r1: R1Inputs;
  r2: R2Inputs;
  r3: R3Inputs;
  r4: R4Inputs;
  r5: R5Inputs;
  r6: R6Inputs;
  r7Trades: { trades: InsiderTrade[] };
}

export interface RiskScoreResult {
  score: number;
  dataQuality: "full" | "sparse";
  signals: SignalRecord[];
}

export function computeRiskScore(inputs: ComputeRiskScoreInputs): RiskScoreResult {
  const r1 = computeR1DividendCut(inputs.r1);
  const r2 = computeR2CoverageDeterioration(inputs.r2);
  const r3 = computeR3PayoutRatioBreach(inputs.r3);
  const r4 = computeR4EarningsRevisions(inputs.r4);
  const r5 = computeR5DebtAcceleration(inputs.r5);
  const r6 = computeR6InterestCoverageDecline(inputs.r6);

  const preceding = r1.points + r2.points + r3.points + r4.points + r5.points + r6.points;
  const r7 = computeR7InsiderSelling({
    symbol: inputs.symbol,
    trades: inputs.r7Trades.trades,
    precedingRiskPoints: preceding,
  });

  const total = Math.min(100, preceding + r7.points);
  const dataQuality: "full" | "sparse" = r4.dataQualityFlag === "sparse" ? "sparse" : "full";

  // weight column carries the signal's max points (for UI bar scaling); for the
  // additive Risk model effectiveWeight mirrors it.
  const signals: SignalRecord[] = [
    { code: "R1", score: r1.points, weight: 60, effectiveWeight: 60, humanLabel: r1.reason },
    { code: "R2", score: r2.points, weight: 25, effectiveWeight: 25, humanLabel: r2.reason },
    { code: "R3", score: r3.points, weight: 20, effectiveWeight: 20, humanLabel: r3.reason },
    { code: "R4", score: r4.points, weight: 15, effectiveWeight: 15, humanLabel: r4.reason },
    { code: "R5", score: r5.points, weight: 15, effectiveWeight: 15, humanLabel: r5.reason },
    { code: "R6", score: r6.points, weight: 15, effectiveWeight: 15, humanLabel: r6.reason },
    { code: "R7", score: r7.points, weight: 10, effectiveWeight: 10, humanLabel: r7.reason },
  ];

  return { score: total, dataQuality, signals };
}

// Fork of compute-{buy,trim,risk}-score with weights exposed as a parameter.
// Prod's orchestrators hardcode A_WEIGHTS / B_WEIGHTS / category weights inside
// the function body — fine for prod but useless for analyst what-if work. This
// fork imports the same pure per-signal compute functions from prod and applies
// the caller's weights at aggregation time. Score formulas are otherwise
// identical to prod.

import { runQualityGates, type GateCode } from "../../dividendmapper/lib/scoring/quality-gates";
import { computeA1YieldPercentile } from "../../dividendmapper/lib/scoring/signals/a1-yield-percentile";
import { computeA2PeVsHistory } from "../../dividendmapper/lib/scoring/signals/a2-pe-vs-history";
import { computeA3DcfGap } from "../../dividendmapper/lib/scoring/signals/a3-dcf-gap";
import { computeB1Below200dMa } from "../../dividendmapper/lib/scoring/signals/b1-below-200d-ma";
import { computeB2Below52wHigh } from "../../dividendmapper/lib/scoring/signals/b2-below-52w-high";
import { computeB3Rsi14 } from "../../dividendmapper/lib/scoring/signals/b3-rsi-14";
import { computeC1TargetSpread } from "../../dividendmapper/lib/scoring/signals/c1-target-spread";
import { computeC2NetUpgrades } from "../../dividendmapper/lib/scoring/signals/c2-net-upgrades";
import { computeC3InsiderBuying } from "../../dividendmapper/lib/scoring/signals/c3-insider-buying";
import { computeD1YieldVsSector } from "../../dividendmapper/lib/scoring/signals/d1-yield-vs-sector";
import { computeD2ExDivProximity } from "../../dividendmapper/lib/scoring/signals/d2-ex-div-proximity";
import {
  computeTrimA1, computeTrimA2, computeTrimA3,
} from "../../dividendmapper/lib/scoring/signals/trim-a-signals";
import {
  computeTrimB1, computeTrimB2, computeTrimB3,
} from "../../dividendmapper/lib/scoring/signals/trim-b-signals";
import {
  computeTrimC1, computeTrimC2,
} from "../../dividendmapper/lib/scoring/signals/trim-c-signals";
import { computeR1DividendCut } from "../../dividendmapper/lib/scoring/signals/r1-dividend-cut";
import { computeR2CoverageDeterioration } from "../../dividendmapper/lib/scoring/signals/r2-coverage-deterioration";
import { computeR3PayoutRatioBreach } from "../../dividendmapper/lib/scoring/signals/r3-payout-ratio-breach";
import { computeR4EarningsRevisions } from "../../dividendmapper/lib/scoring/signals/r4-earnings-revisions";
import { computeR5DebtAcceleration } from "../../dividendmapper/lib/scoring/signals/r5-debt-acceleration";
import { computeR6InterestCoverageDecline } from "../../dividendmapper/lib/scoring/signals/r6-interest-coverage-decline";
import { computeR7InsiderSelling } from "../../dividendmapper/lib/scoring/signals/r7-insider-selling";
import {
  computeCategoryAggregate, type SignalWeight,
} from "../../dividendmapper/lib/scoring/redistribute-weights";
import type { ComputeBuyScoreInputs } from "../../dividendmapper/lib/scoring/compute-buy-score";
import type { ComputeTrimScoreInputs } from "../../dividendmapper/lib/scoring/compute-trim-score";
import type { ComputeRiskScoreInputs } from "../../dividendmapper/lib/scoring/compute-risk-score";

export interface Weights {
  buy: {
    categories: { A: number; B: number; C: number; D: number };
    signals: {
      A1: number; A2: number; A3: number;
      B1: number; B2: number; B3: number;
      C1: number; C2: number; C3: number;
      D1: number; D2: number;
    };
  };
  trim: {
    categories: { A: number; B: number; C: number };
    signals: {
      A1: number; A2: number; A3: number;
      B1: number; B2: number; B3: number;
      C1: number; C2: number;
    };
  };
}

export interface SignalRecord {
  code: string;
  score: number | null;
  humanLabel: string;
}

export interface BuyScoreResult {
  score: number | null;
  qualityGatePassed: boolean;
  failedGates: GateCode[];
  reason?: "quality_gate_failed" | "insufficient_signals";
  signals: SignalRecord[];
}

export interface TrimScoreResult {
  score: number | null;
  reason?: "insufficient_signals";
  signals: SignalRecord[];
}

export interface RiskScoreResult {
  score: number;
  signals: SignalRecord[];
}

// ---------------------------------------------------------------------------
// Buy
// ---------------------------------------------------------------------------

export function computeBuyScore(
  inputs: ComputeBuyScoreInputs,
  weights: Weights["buy"],
): BuyScoreResult {
  const gates = runQualityGates(inputs);
  if (!gates.passed) {
    return {
      score: null,
      qualityGatePassed: false,
      failedGates: gates.failedGates,
      reason: "quality_gate_failed",
      signals: [],
    };
  }

  const a1 = computeA1YieldPercentile(inputs.a1);
  const a2 = computeA2PeVsHistory(inputs.a2);
  const a3 = computeA3DcfGap(inputs.a3);
  const b1 = computeB1Below200dMa(inputs.b1);
  const b2 = computeB2Below52wHigh(inputs.b2);
  const b3 = computeB3Rsi14(inputs.b3);
  const c1 = computeC1TargetSpread(inputs.c1);
  const c2 = computeC2NetUpgrades(inputs.c2);
  const c3 = computeC3InsiderBuying(inputs.c3);
  const d1 = computeD1YieldVsSector(inputs.d1);
  const d2 = computeD2ExDivProximity(inputs.d2);

  // A3 soft-signal halving for non-US (mirrors prod).
  const a3Base = a3.softSignal ? weights.signals.A3 * 0.5 : weights.signals.A3;
  const a3Forfeited = weights.signals.A3 - a3Base;
  const a1Sum = weights.signals.A1 + weights.signals.A2;
  const a1Eff = weights.signals.A1 + (a1Sum > 0 ? a3Forfeited * (weights.signals.A1 / a1Sum) : 0);
  const a2Eff = weights.signals.A2 + (a1Sum > 0 ? a3Forfeited * (weights.signals.A2 / a1Sum) : 0);

  const aSig: SignalWeight[] = [
    { code: "A1", score: a1.score, weight: a1Eff },
    { code: "A2", score: a2.score, weight: a2Eff },
    { code: "A3", score: a3.score, weight: a3Base },
  ];
  const bSig: SignalWeight[] = [
    { code: "B1", score: b1.score, weight: weights.signals.B1 },
    { code: "B2", score: b2.score, weight: weights.signals.B2 },
    { code: "B3", score: b3.score, weight: weights.signals.B3 },
  ];
  const cSig: SignalWeight[] = [
    { code: "C1", score: c1.score, weight: weights.signals.C1 },
    { code: "C2", score: c2.score, weight: weights.signals.C2 },
    { code: "C3", score: c3.score, weight: weights.signals.C3 },
  ];
  const dSig: SignalWeight[] = [
    { code: "D1", score: d1.score, weight: weights.signals.D1 },
    { code: "D2", score: d2.score, weight: weights.signals.D2 },
  ];

  const aAgg = computeCategoryAggregate(aSig);
  const bAgg = computeCategoryAggregate(bSig);
  const cAgg = computeCategoryAggregate(cSig);
  const dAgg = computeCategoryAggregate(dSig);

  const collapsed = [aAgg, bAgg, cAgg, dAgg].filter((x) => x === null).length;
  if (collapsed >= 2) {
    return {
      score: null,
      qualityGatePassed: true,
      failedGates: [],
      reason: "insufficient_signals",
      signals: buildRecords(
        [...aSig, ...bSig, ...cSig, ...dSig],
        [a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2],
      ),
    };
  }

  const cats = [
    { agg: aAgg, w: weights.categories.A },
    { agg: bAgg, w: weights.categories.B },
    { agg: cAgg, w: weights.categories.C },
    { agg: dAgg, w: weights.categories.D },
  ].filter((c) => c.agg !== null);
  const wSum = cats.reduce((a, c) => a + c.w, 0) || 1;
  const score = Math.round(
    cats.reduce((a, c) => a + (c.agg as { value: number }).value * (c.w / wSum), 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    qualityGatePassed: true,
    failedGates: [],
    signals: buildRecords(
      [...aSig, ...bSig, ...cSig, ...dSig],
      [a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2],
    ),
  };
}

// ---------------------------------------------------------------------------
// Trim
// ---------------------------------------------------------------------------

export function computeTrimScore(
  inputs: ComputeTrimScoreInputs,
  weights: Weights["trim"],
): TrimScoreResult {
  const a1 = computeTrimA1(inputs.a1);
  const a2 = computeTrimA2(inputs.a2);
  const a3 = computeTrimA3(inputs.a3);
  const b1 = computeTrimB1(inputs.b1);
  const b2 = computeTrimB2(inputs.b2);
  const b3 = computeTrimB3(inputs.b3);
  const c1 = computeTrimC1(inputs.c1);
  const c2 = computeTrimC2(inputs.c2);

  const a3Base = a3.softSignal ? weights.signals.A3 * 0.5 : weights.signals.A3;
  const a3Forfeited = weights.signals.A3 - a3Base;
  const a1Sum = weights.signals.A1 + weights.signals.A2;
  const a1Eff = weights.signals.A1 + (a1Sum > 0 ? a3Forfeited * (weights.signals.A1 / a1Sum) : 0);
  const a2Eff = weights.signals.A2 + (a1Sum > 0 ? a3Forfeited * (weights.signals.A2 / a1Sum) : 0);

  const aSig: SignalWeight[] = [
    { code: "T-A1", score: a1.score, weight: a1Eff },
    { code: "T-A2", score: a2.score, weight: a2Eff },
    { code: "T-A3", score: a3.score, weight: a3Base },
  ];
  const bSig: SignalWeight[] = [
    { code: "T-B1", score: b1.score, weight: weights.signals.B1 },
    { code: "T-B2", score: b2.score, weight: weights.signals.B2 },
    { code: "T-B3", score: b3.score, weight: weights.signals.B3 },
  ];
  const cSig: SignalWeight[] = [
    { code: "T-C1", score: c1.score, weight: weights.signals.C1 },
    { code: "T-C2", score: c2.score, weight: weights.signals.C2 },
  ];

  const aAgg = computeCategoryAggregate(aSig);
  const bAgg = computeCategoryAggregate(bSig);
  const cAgg = computeCategoryAggregate(cSig);

  const collapsed = [aAgg, bAgg, cAgg].filter((x) => x === null).length;
  if (collapsed >= 2) {
    return { score: null, reason: "insufficient_signals", signals: [] };
  }

  const cats = [
    { agg: aAgg, w: weights.categories.A },
    { agg: bAgg, w: weights.categories.B },
    { agg: cAgg, w: weights.categories.C },
  ].filter((c) => c.agg !== null);
  const wSum = cats.reduce((a, c) => a + c.w, 0) || 1;
  const score = Math.round(
    cats.reduce((a, c) => a + (c.agg as { value: number }).value * (c.w / wSum), 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    signals: buildRecords(
      [...aSig, ...bSig, ...cSig],
      [a1, a2, a3, b1, b2, b3, c1, c2],
    ),
  };
}

// ---------------------------------------------------------------------------
// Risk — additive points model. Weights aren't user-tunable in v1 (the points
// schedule IS the weighting), so this just calls prod's per-signal computes.
// ---------------------------------------------------------------------------

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

  return {
    score: total,
    signals: [
      { code: "R1", score: r1.points, humanLabel: r1.reason },
      { code: "R2", score: r2.points, humanLabel: r2.reason },
      { code: "R3", score: r3.points, humanLabel: r3.reason },
      { code: "R4", score: r4.points, humanLabel: r4.reason },
      { code: "R5", score: r5.points, humanLabel: r5.reason },
      { code: "R6", score: r6.points, humanLabel: r6.reason },
      { code: "R7", score: r7.points, humanLabel: r7.reason },
    ],
  };
}

// ---------------------------------------------------------------------------

function buildRecords(
  weighted: SignalWeight[],
  raw: { score: number | null; humanLabel: string }[],
): SignalRecord[] {
  return weighted.map((w, i) => ({
    code: w.code,
    score: raw[i].score,
    humanLabel: raw[i].humanLabel,
  }));
}

// Composite Buy/Hold/Trim/Sell signal (mirrors prod's actionHint priority).
export function compositeSignal(buy: number | null, trim: number | null, risk: number): string {
  if (risk >= 75) return "Sell";
  if (risk >= 50) return "Trim";
  if (trim != null && trim >= 75) return "Trim";
  if (trim != null && trim >= 50) return "Hold";
  if (buy != null && buy >= 75) return "Buy";
  if (buy != null && buy >= 50) return "Hold";
  return "Hold";
}

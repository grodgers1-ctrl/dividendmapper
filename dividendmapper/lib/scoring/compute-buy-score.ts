// Phase 2.75 Buy Score orchestrator. Quality gates → 11 signals → category
// aggregates with N/A redistribution → final 0-100 score, plus a full
// per-signal breakdown the cron persists to equity_score_signals.

import { runQualityGates, type QualityGateInputs, type GateCode } from "./quality-gates";
import { computeA1YieldPercentile, type A1Inputs } from "./signals/a1-yield-percentile";
import { computeA2PeVsHistory, type A2Inputs } from "./signals/a2-pe-vs-history";
import { computeA3DcfGap, type A3Inputs } from "./signals/a3-dcf-gap";
import { computeB1Below200dMa, type B1Inputs } from "./signals/b1-below-200d-ma";
import { computeB2Below52wHigh, type B2Inputs } from "./signals/b2-below-52w-high";
import { computeB3Rsi14, type B3Inputs } from "./signals/b3-rsi-14";
import { computeC1TargetSpread, type C1Inputs } from "./signals/c1-target-spread";
import { computeC2NetUpgrades, type C2Inputs } from "./signals/c2-net-upgrades";
import { computeC3InsiderBuying, type C3Inputs } from "./signals/c3-insider-buying";
import { computeD1YieldVsSector, type D1Inputs } from "./signals/d1-yield-vs-sector";
import { computeD2ExDivProximity, type D2Inputs } from "./signals/d2-ex-div-proximity";
import { computeCategoryAggregate, type SignalWeight } from "./redistribute-weights";
import { BUY_BASE_WEIGHTS } from "./weights";
import type { Sector } from "./sector";

export interface ComputeBuyScoreInputs extends QualityGateInputs {
  symbol: string;
  isUs: boolean;
  a1: A1Inputs;
  a2: A2Inputs;
  a3: A3Inputs;
  b1: B1Inputs;
  b2: B2Inputs;
  b3: B3Inputs;
  c1: C1Inputs;
  c2: C2Inputs;
  c3: C3Inputs;
  d1: D1Inputs;
  d2: D2Inputs;
  sector: Sector;
}

export interface SignalRecord {
  code: string;
  score: number | null;
  weight: number; // base weight within category
  effectiveWeight: number; // post-redistribution weight within category
  humanLabel: string;
}

export interface BuyScoreResult {
  score: number | null;
  qualityGatePassed: boolean;
  failedGates: GateCode[];
  reason?: "quality_gate_failed" | "insufficient_signals";
  signals: SignalRecord[];
}

const A_WEIGHTS = { A1: 0.5, A2: 0.3, A3: 0.2 };
const B_WEIGHTS = { B1: 0.4, B2: 0.3, B3: 0.3 };
const C_WEIGHTS = { C1: 0.5, C2: 0.25, C3: 0.25 };
const D_WEIGHTS = { D1: 0.6, D2: 0.4 };

export function computeBuyScore(inputs: ComputeBuyScoreInputs): BuyScoreResult {
  // 1. Quality gates
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

  // 2. Run all signals
  const a1r = computeA1YieldPercentile(inputs.a1);
  const a2r = computeA2PeVsHistory(inputs.a2);
  const a3r = computeA3DcfGap(inputs.a3);
  const b1r = computeB1Below200dMa(inputs.b1);
  const b2r = computeB2Below52wHigh(inputs.b2);
  const b3r = computeB3Rsi14(inputs.b3);
  const c1r = computeC1TargetSpread(inputs.c1);
  const c2r = computeC2NetUpgrades(inputs.c2);
  const c3r = computeC3InsiderBuying(inputs.c3);
  const d1r = computeD1YieldVsSector(inputs.d1);
  const d2r = computeD2ExDivProximity(inputs.d2);

  // 3. Build category signal-weight arrays, applying A3 soft-signal half-weight
  //    for non-US (which we model as N/A-with-half-weight by redistributing
  //    half of A3's weight to siblings; cleaner than tracking a separate flag).
  const a3Base = a3r.softSignal ? A_WEIGHTS.A3 * 0.5 : A_WEIGHTS.A3;
  const a3Forfeited = A_WEIGHTS.A3 - a3Base;
  // Forfeited weight redistributes to A1 + A2 proportionally
  const a1Eff = A_WEIGHTS.A1 + a3Forfeited * (A_WEIGHTS.A1 / (A_WEIGHTS.A1 + A_WEIGHTS.A2));
  const a2Eff = A_WEIGHTS.A2 + a3Forfeited * (A_WEIGHTS.A2 / (A_WEIGHTS.A1 + A_WEIGHTS.A2));

  const aSignals: SignalWeight[] = [
    { code: "A1", score: a1r.score, weight: a1Eff },
    { code: "A2", score: a2r.score, weight: a2Eff },
    { code: "A3", score: a3r.score, weight: a3Base },
  ];
  const bSignals: SignalWeight[] = [
    { code: "B1", score: b1r.score, weight: B_WEIGHTS.B1 },
    { code: "B2", score: b2r.score, weight: B_WEIGHTS.B2 },
    { code: "B3", score: b3r.score, weight: B_WEIGHTS.B3 },
  ];
  const cSignals: SignalWeight[] = [
    { code: "C1", score: c1r.score, weight: C_WEIGHTS.C1 },
    { code: "C2", score: c2r.score, weight: C_WEIGHTS.C2 },
    { code: "C3", score: c3r.score, weight: C_WEIGHTS.C3 },
  ];
  const dSignals: SignalWeight[] = [
    { code: "D1", score: d1r.score, weight: D_WEIGHTS.D1 },
    { code: "D2", score: d2r.score, weight: D_WEIGHTS.D2 },
  ];

  // 4. Category aggregates
  const aAgg = computeCategoryAggregate(aSignals);
  const bAgg = computeCategoryAggregate(bSignals);
  const cAgg = computeCategoryAggregate(cSignals);
  const dAgg = computeCategoryAggregate(dSignals);

  const collapsedCount = [aAgg, bAgg, cAgg, dAgg].filter((x) => x === null).length;
  if (collapsedCount >= 2) {
    return {
      score: null,
      qualityGatePassed: true,
      failedGates: [],
      reason: "insufficient_signals",
      signals: buildSignalRecords(
        [aSignals, bSignals, cSignals, dSignals],
        [a1r, a2r, a3r, b1r, b2r, b3r, c1r, c2r, c3r, d1r, d2r],
      ),
    };
  }

  // 5. Category-level redistribution if exactly one category collapsed
  const baseCategoryWeights = {
    A: BUY_BASE_WEIGHTS.A,
    B: BUY_BASE_WEIGHTS.B,
    C: BUY_BASE_WEIGHTS.C,
    D: BUY_BASE_WEIGHTS.D,
  };
  const availableCategories = [
    { key: "A", agg: aAgg, baseWeight: baseCategoryWeights.A },
    { key: "B", agg: bAgg, baseWeight: baseCategoryWeights.B },
    { key: "C", agg: cAgg, baseWeight: baseCategoryWeights.C },
    { key: "D", agg: dAgg, baseWeight: baseCategoryWeights.D },
  ].filter((c) => c.agg !== null);
  const availableWeightSum = availableCategories.reduce((a, c) => a + c.baseWeight, 0);
  const finalScore = Math.round(
    availableCategories.reduce(
      (a, c) => a + (c.agg as { value: number }).value * (c.baseWeight / availableWeightSum),
      0,
    ),
  );

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    qualityGatePassed: true,
    failedGates: [],
    signals: buildSignalRecords(
      [aSignals, bSignals, cSignals, dSignals],
      [a1r, a2r, a3r, b1r, b2r, b3r, c1r, c2r, c3r, d1r, d2r],
    ),
  };
}

function buildSignalRecords(
  categoryArrays: SignalWeight[][],
  rawResults: { score: number | null; humanLabel: string }[],
): SignalRecord[] {
  const records: SignalRecord[] = [];
  let idx = 0;
  for (const cat of categoryArrays) {
    // Recompute redistribution to get effective weights
    const available = cat.filter((s) => s.score != null);
    const availableSum = available.reduce((a, s) => a + s.weight, 0);
    for (const s of cat) {
      const r = rawResults[idx++];
      records.push({
        code: s.code,
        score: s.score,
        weight: s.weight,
        effectiveWeight: s.score == null || availableSum === 0 ? 0 : s.weight / availableSum,
        humanLabel: r.humanLabel,
      });
    }
  }
  return records;
}

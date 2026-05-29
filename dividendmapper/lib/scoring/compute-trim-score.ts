// Phase 2.75 Trim Score orchestrator. Same shape as compute-buy-score but:
// no quality gate (you can always trim), category weights T-A=0.40/T-B=0.35/
// T-C=0.25, and only 8 signals (no insider/dividend-timing categories). Same
// N/A redistribution + non-US soft-signal halving for T-A3.

import type { Sector } from "./sector";
import type { SignalResult, A1Inputs } from "./signals/a1-yield-percentile";
import type { A2Inputs } from "./signals/a2-pe-vs-history";
import type { A3Inputs } from "./signals/a3-dcf-gap";
import type { B1Inputs } from "./signals/b1-below-200d-ma";
import type { B2Inputs } from "./signals/b2-below-52w-high";
import type { B3Inputs } from "./signals/b3-rsi-14";
import type { C1Inputs } from "./signals/c1-target-spread";
import type { C2Inputs } from "./signals/c2-net-upgrades";
import { computeTrimA1, computeTrimA2, computeTrimA3 } from "./signals/trim-a-signals";
import { computeTrimB1, computeTrimB2, computeTrimB3 } from "./signals/trim-b-signals";
import { computeTrimC1, computeTrimC2 } from "./signals/trim-c-signals";
import { computeCategoryAggregate, type SignalWeight } from "./redistribute-weights";
import { TRIM_BASE_WEIGHTS } from "./weights";
import type { SignalRecord } from "./compute-buy-score";

export interface ComputeTrimScoreInputs {
  symbol: string;
  isUs: boolean;
  sector: Sector;
  a1: A1Inputs;
  a2: A2Inputs;
  a3: A3Inputs;
  b1: B1Inputs;
  b2: B2Inputs;
  b3: B3Inputs;
  c1: C1Inputs;
  c2: C2Inputs;
}

export interface TrimScoreResult {
  score: number | null;
  reason?: "insufficient_signals";
  signals: SignalRecord[];
}

const TA = { A1: 0.5, A2: 0.3, A3: 0.2 };
const TB = { B1: 0.45, B2: 0.2, B3: 0.35 };
const TC = { C1: 0.6, C2: 0.4 };

export function computeTrimScore(inputs: ComputeTrimScoreInputs): TrimScoreResult {
  const a1r = computeTrimA1(inputs.a1);
  const a2r = computeTrimA2(inputs.a2);
  const a3r = computeTrimA3(inputs.a3);
  const b1r = computeTrimB1(inputs.b1);
  const b2r = computeTrimB2(inputs.b2);
  const b3r = computeTrimB3(inputs.b3);
  const c1r = computeTrimC1(inputs.c1);
  const c2r = computeTrimC2(inputs.c2);

  const a3Base = a3r.softSignal ? TA.A3 * 0.5 : TA.A3;
  const a3Forfeited = TA.A3 - a3Base;
  const a1Eff = TA.A1 + a3Forfeited * (TA.A1 / (TA.A1 + TA.A2));
  const a2Eff = TA.A2 + a3Forfeited * (TA.A2 / (TA.A1 + TA.A2));

  const aSignals: SignalWeight[] = [
    { code: "T-A1", score: a1r.score, weight: a1Eff },
    { code: "T-A2", score: a2r.score, weight: a2Eff },
    { code: "T-A3", score: a3r.score, weight: a3Base },
  ];
  const bSignals: SignalWeight[] = [
    { code: "T-B1", score: b1r.score, weight: TB.B1 },
    { code: "T-B2", score: b2r.score, weight: TB.B2 },
    { code: "T-B3", score: b3r.score, weight: TB.B3 },
  ];
  const cSignals: SignalWeight[] = [
    { code: "T-C1", score: c1r.score, weight: TC.C1 },
    { code: "T-C2", score: c2r.score, weight: TC.C2 },
  ];

  const aAgg = computeCategoryAggregate(aSignals);
  const bAgg = computeCategoryAggregate(bSignals);
  const cAgg = computeCategoryAggregate(cSignals);

  const collapsedCount = [aAgg, bAgg, cAgg].filter((x) => x === null).length;
  if (collapsedCount >= 2) {
    return { score: null, reason: "insufficient_signals", signals: [] };
  }

  const availableCategories = [
    { agg: aAgg, baseWeight: TRIM_BASE_WEIGHTS.A },
    { agg: bAgg, baseWeight: TRIM_BASE_WEIGHTS.B },
    { agg: cAgg, baseWeight: TRIM_BASE_WEIGHTS.C },
  ].filter((c) => c.agg !== null);
  const availableSum = availableCategories.reduce((a, c) => a + c.baseWeight, 0);
  const finalScore = Math.round(
    availableCategories.reduce(
      (a, c) => a + (c.agg as { value: number }).value * (c.baseWeight / availableSum),
      0,
    ),
  );

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    signals: buildSignalRecords(
      [aSignals, bSignals, cSignals],
      [a1r, a2r, a3r, b1r, b2r, b3r, c1r, c2r],
    ),
  };
}

function buildSignalRecords(
  categoryArrays: SignalWeight[][],
  rawResults: SignalResult[],
): SignalRecord[] {
  const records: SignalRecord[] = [];
  let idx = 0;
  for (const cat of categoryArrays) {
    const available = cat.filter((s) => s.score != null);
    const availSum = available.reduce((a, s) => a + s.weight, 0);
    for (const s of cat) {
      const r = rawResults[idx++];
      records.push({
        code: s.code,
        score: s.score,
        weight: s.weight,
        effectiveWeight: s.score == null || availSum === 0 ? 0 : s.weight / availSum,
        humanLabel: r.humanLabel,
      });
    }
  }
  return records;
}

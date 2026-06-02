// Render-time Buy-score re-aggregation for the opt-in personalisation lens.
// Rebuilds the 0-100 score from persisted equity_score_signals using per-user
// category weights. Pure; never changes what the cron writes.

import { BUY_BASE_WEIGHTS, type BuyCategoryWeights } from "./weights";
import { computeCategoryAggregate, type SignalWeight } from "./redistribute-weights";

export interface StoredSignal {
  signal_code: string; // A1, B2, ...
  raw_score: number | null;
  weight: number; // base within-category weight, as persisted
}

export interface WeightPrefs {
  primary_goal?: string | null;
  investing_horizon?: string | null;
  risk_appetite?: string | null;
}

type Cat = "A" | "B" | "C" | "D";
const CATS: Cat[] = ["A", "B", "C", "D"];
const CLAMP_MIN = 0.05;
const CLAMP_MAX = 0.55;

// Additive deltas per answer (spec table). Trim/Risk are never reweighted.
const DELTAS: Record<string, Partial<Record<Cat, number>>> = {
  "goal:income_now": { A: 0.05, B: -0.1, C: -0.05, D: 0.1 },
  "goal:total_return": { A: 0.05, B: 0.08, C: 0.02, D: -0.1 },
  "goal:safety_stability": { A: 0.1, B: -0.08, C: -0.05, D: 0.03 },
  "horizon:10y_plus": { A: 0.08, B: -0.08 },
  "horizon:lt_5y": { A: -0.05, B: 0.03, D: 0.05 },
  "horizon:already_retired": { A: -0.05, B: 0.03, D: 0.05 },
  "risk:aggressive": { A: -0.05, B: 0.08, C: 0.05, D: -0.05 },
  "risk:cautious": { A: 0.08, B: -0.05, C: -0.05 },
};

export function categoryWeightsFor(prefs: WeightPrefs | null): BuyCategoryWeights {
  if (!prefs) return { ...BUY_BASE_WEIGHTS };
  const w: Record<Cat, number> = { ...BUY_BASE_WEIGHTS };
  const keys = [
    prefs.primary_goal && prefs.primary_goal !== "undecided" ? `goal:${prefs.primary_goal}` : null,
    prefs.investing_horizon && prefs.investing_horizon !== "undecided"
      ? `horizon:${prefs.investing_horizon}`
      : null,
    prefs.risk_appetite && prefs.risk_appetite !== "undecided" ? `risk:${prefs.risk_appetite}` : null,
  ].filter((k): k is string => k !== null);

  // No weight-affecting answers: return exact base (skip the renormalise, which
  // would otherwise introduce float drift like 0.35000000000000003).
  if (keys.length === 0) return { ...BUY_BASE_WEIGHTS };

  for (const k of keys) {
    const d = DELTAS[k];
    if (!d) continue;
    for (const c of CATS) if (d[c]) w[c] += d[c] as number;
  }
  // clamp then renormalise to sum 1
  for (const c of CATS) w[c] = Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, w[c]));
  const sum = CATS.reduce((a, c) => a + w[c], 0);
  for (const c of CATS) w[c] = w[c] / sum;
  return w;
}

export function reaggregateBuyScore(
  signals: StoredSignal[],
  weights: BuyCategoryWeights,
): number | null {
  if (signals.length === 0) return null;
  const byCat: Record<Cat, SignalWeight[]> = { A: [], B: [], C: [], D: [] };
  for (const s of signals) {
    const c = s.signal_code[0] as Cat;
    if (byCat[c]) byCat[c].push({ code: s.signal_code, score: s.raw_score, weight: s.weight });
  }
  const available = CATS.map((c) => ({
    agg: computeCategoryAggregate(byCat[c]),
    base: weights[c],
  })).filter((x) => x.agg !== null);
  if (available.length === 0) return null;
  const wSum = available.reduce((a, x) => a + x.base, 0);
  const score = available.reduce(
    (a, x) => a + (x.agg as { value: number }).value * (x.base / wSum),
    0,
  );
  return Math.max(0, Math.min(100, Math.round(score)));
}

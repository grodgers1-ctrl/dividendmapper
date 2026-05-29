// N/A weight cascade. Used by compute-buy-score and compute-trim-score.
//
// Within a category: if some signals are N/A, redistribute their weight
// proportionally to sibling signals that DO have a score.
// If ALL signals in a category are N/A, the category aggregate is null
// (the orchestrator handles category-level redistribution).

export interface SignalWeight {
  code: string;
  score: number | null;
  weight: number; // base weight, sums to 1.0 across category
}

export interface RedistributedSignal {
  code: string;
  score: number | null;
  effectiveWeight: number;
}

export function redistributeWithinCategory(signals: SignalWeight[]): RedistributedSignal[] {
  const available = signals.filter((s) => s.score != null);
  if (available.length === 0) {
    return signals.map((s) => ({ code: s.code, score: s.score, effectiveWeight: 0 }));
  }
  const availableWeightSum = available.reduce((a, s) => a + s.weight, 0);
  return signals.map((s) => {
    if (s.score == null) return { code: s.code, score: null, effectiveWeight: 0 };
    return {
      code: s.code,
      score: s.score,
      effectiveWeight: s.weight / availableWeightSum,
    };
  });
}

export interface CategoryAggregate {
  value: number;
  contributingCount: number;
}

export function computeCategoryAggregate(signals: SignalWeight[]): CategoryAggregate | null {
  const redistributed = redistributeWithinCategory(signals);
  const contributing = redistributed.filter((r) => r.effectiveWeight > 0);
  if (contributing.length === 0) return null;
  const value = contributing.reduce((a, r) => a + (r.score as number) * r.effectiveWeight, 0);
  return { value, contributingCount: contributing.length };
}

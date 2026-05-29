// Per-category Buy weights. Wizard answers shift weights at RENDER time;
// the cron writes BASE-weighted scores to equity_scores. UI fetches the
// per-signal contributions from equity_score_signals + re-aggregates using
// applyUserWeights(base, userPrefs).

export interface BuyCategoryWeights {
  A: number; // Valuation
  B: number; // Technical
  C: number; // Sentiment
  D: number; // Dividend timing
}

export const BUY_BASE_WEIGHTS: BuyCategoryWeights = {
  A: 0.35,
  B: 0.3,
  C: 0.2,
  D: 0.15,
};

export const TRIM_BASE_WEIGHTS = {
  A: 0.4,
  B: 0.35,
  C: 0.25,
};

export interface UserScoringPrefs {
  primary_goal?: "income_now" | "total_return" | "safety_stability" | "undecided" | null;
  // Investing horizon and risk appetite are consumed elsewhere (action-hint
  // thresholds + quality-gate tightness); not relevant to category weights.
}

export function applyUserWeights(
  base: BuyCategoryWeights,
  prefs: UserScoringPrefs | null,
): BuyCategoryWeights {
  if (!prefs || !prefs.primary_goal || prefs.primary_goal === "undecided") {
    return { ...base };
  }
  if (prefs.primary_goal === "income_now") {
    return { ...base, D: base.D + 0.05, B: base.B - 0.05 };
  }
  // total_return and safety_stability use defaults at the category-weight level.
  return { ...base };
}

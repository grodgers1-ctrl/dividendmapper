// Phase 2.75 Day 6. Pure assembly: turn raw DB rows (equity_scores +
// score_overrides + a 30-day-ago history row) into the HoldingScore shape the
// holdings-table chips consume. No I/O — the page.tsx server query feeds it.

import { actionHint, formatDelta, type Delta, type ScoreType } from "./chip-display";
import { primaryGateReason } from "./gate-reasons";
import type { GateCode } from "./quality-gates";

export type ScoreRow = {
  ticker: string;
  buy_score: number | null;
  trim_score: number | null;
  risk_score: number | null;
  buy_failed_gates: string[] | null;
  data_quality: string;
};

export type PriorHistory = {
  buy_score: number | null;
  trim_score: number | null;
  risk_score: number | null;
};

export type OverrideRow = {
  score_type: string;
  expires_at: string;
};

export type HoldingScore = {
  ticker: string;
  buy: number | null;
  trim: number | null;
  risk: number | null;
  buyFailedGates: string[];
  buyGateReason: string | null;
  dataQuality: string;
  deltas: Record<ScoreType, Delta | null>;
  hidden: Record<ScoreType, boolean>;
  actionHint: string;
};

function delta(current: number | null, prior: number | null | undefined): Delta | null {
  if (current === null || current === undefined) return null;
  return formatDelta(current, prior ?? null);
}

function isHidden(overrides: OverrideRow[], type: ScoreType, now: Date): boolean {
  return overrides.some(
    (o) => o.score_type === type && new Date(o.expires_at).getTime() > now.getTime(),
  );
}

export function buildHoldingScore(input: {
  score: ScoreRow;
  priorHistory: PriorHistory | null;
  overrides: OverrideRow[];
  now: Date;
}): HoldingScore {
  const { score, priorHistory, overrides, now } = input;
  const failedGates = (score.buy_failed_gates ?? []) as GateCode[];

  return {
    ticker: score.ticker,
    buy: score.buy_score,
    trim: score.trim_score,
    risk: score.risk_score,
    buyFailedGates: failedGates,
    buyGateReason: score.buy_score === null ? primaryGateReason(failedGates) : null,
    dataQuality: score.data_quality,
    deltas: {
      buy: delta(score.buy_score, priorHistory?.buy_score),
      trim: delta(score.trim_score, priorHistory?.trim_score),
      risk: delta(score.risk_score, priorHistory?.risk_score),
    },
    hidden: {
      buy: isHidden(overrides, "buy", now),
      trim: isHidden(overrides, "trim", now),
      risk: isHidden(overrides, "risk", now),
    },
    actionHint: actionHint({
      buy: score.buy_score,
      trim: score.trim_score,
      risk: score.risk_score,
    }),
  };
}

// Identity stub. The Day 8 personalisation wizard will tune per-user weights
// here at render time (per spec: per-ticker scoring, per-user weighting). Until
// any user_preferences rows exist, scores pass through unchanged.
export function applyUserWeights(
  score: HoldingScore,
  _prefs: null,
): HoldingScore {
  return score;
}

// Holdings whose action hint warrants attention, for the summary banner.
export function flaggedHoldings(
  scores: HoldingScore[],
): { ticker: string; hint: string }[] {
  return scores
    .filter((s) => s.actionHint !== "Hold")
    .map((s) => ({ ticker: s.ticker, hint: s.actionHint }));
}

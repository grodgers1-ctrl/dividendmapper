// Phase 2.75 Day 6. Pure display helpers for the holdings-table score chips.
// Colour discipline + action-hint priority + trend buckets are lifted verbatim
// from the spec (planning/06-equity-scoring.md lines 753-784).

export type ScoreType = "buy" | "trim" | "risk";

// [>=75, 50-74, <50]. Grey-blue (#94a3b8) is the shared "muted" low tier.
const RAMP: Record<ScoreType, [string, string, string]> = {
  buy: ["#0a8a4f", "#56b87b", "#94a3b8"],
  trim: ["#d97706", "#fbbf24", "#94a3b8"],
  risk: ["#dc2626", "#f87171", "#94a3b8"],
};

export function chipColor(type: ScoreType, score: number): { hex: string } {
  const [high, mid, low] = RAMP[type];
  if (score >= 75) return { hex: high };
  if (score >= 50) return { hex: mid };
  return { hex: low };
}

// Priority order per spec. A null buy (failed quality gate) is treated as 0 so
// risk/trim still drive the hint.
export function actionHint(s: {
  buy: number | null;
  trim: number | null;
  risk: number | null;
}): string {
  const buy = s.buy ?? 0;
  const trim = s.trim ?? 0;
  const risk = s.risk ?? 0;
  if (risk >= 75) return "Review urgently";
  if (risk >= 50) return "Reassess thesis";
  if (trim >= 75) return "Consider trimming";
  if (trim >= 50) return "Watch — extended";
  if (buy >= 75) return "Add more";
  if (buy >= 50) return "Accumulate on dips";
  return "Hold";
}

export type TrendArrow = "↗" | "→" | "↘";

export function trendArrow(delta: number): TrendArrow {
  if (delta >= 5) return "↗";
  if (delta <= -5) return "↘";
  return "→";
}

export type Delta = { value: number; label: string; arrow: TrendArrow };

// Returns null when there is no prior measurement (e.g. <1 day of history) so
// the chip can omit the delta pill until score history accrues.
export function formatDelta(current: number, prior: number | null): Delta | null {
  if (prior === null || prior === undefined) return null;
  const value = current - prior;
  const label = value >= 0 ? `+${value}` : `${value}`;
  return { value, label, arrow: trendArrow(value) };
}

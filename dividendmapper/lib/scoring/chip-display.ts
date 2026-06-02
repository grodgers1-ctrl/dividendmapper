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

// Action hint surfaces only genuinely actionable cases — elevated Risk (cut
// danger) or Trim (overextended valuation). A high Quality score is a
// descriptor shown via the chip itself, NOT a "buy more" directive, so it
// returns "Hold" (no flag) and does not appear in the attention banner.
//
// `sensitivity` (from the personalisation wizard) shifts both thresholds:
// negative warns earlier (cautious / near-retirement), positive warns later
// (aggressive / long horizon). Default 0 keeps existing callers unchanged.
export function actionHint(
  s: {
    buy: number | null;
    trim: number | null;
    risk: number | null;
  },
  sensitivity = 0,
): string {
  const trim = s.trim ?? 0;
  const risk = s.risk ?? 0;
  if (risk >= 75 + sensitivity) return "Review urgently";
  if (risk >= 50 + sensitivity) return "Reassess thesis";
  if (trim >= 75 + sensitivity) return "Consider trimming";
  if (trim >= 50 + sensitivity) return "Watch: extended";
  return "Hold";
}

export interface ActionHintPrefs {
  risk_appetite?: string | null;
  investing_horizon?: string | null;
}

// Derive the action-hint threshold shift from wizard posture answers. Sums a
// risk-appetite contribution and a horizon contribution, clamped to [-10, +10].
// Posture-only: it never touches the persisted scores.
export function actionHintSensitivity(prefs: ActionHintPrefs | null): number {
  if (!prefs) return 0;
  const risk =
    prefs.risk_appetite === "cautious" ? -5 : prefs.risk_appetite === "aggressive" ? 5 : 0;
  const horizon =
    prefs.investing_horizon === "already_retired" || prefs.investing_horizon === "lt_5y"
      ? -5
      : prefs.investing_horizon === "10y_plus"
        ? 5
        : 0;
  return Math.max(-10, Math.min(10, risk + horizon));
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

import type { HoldingScore } from "./portfolio-scores";

export type Quadrant = "core" | "watch" | "stable" | "review";

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  core: "Core",
  watch: "Watch",
  stable: "Stable",
  review: "Review",
};

// Descriptive, compliance-safe one-liners (no buy/sell language).
export const QUADRANT_NOTE: Record<Quadrant, string> = {
  core: "High quality, lower risk",
  watch: "High quality, higher risk",
  stable: "Lower quality, lower risk",
  review: "Lower quality, higher risk",
};

// Trim at or above this reads as elevated (overextended) and colours amber.
export const TRIM_ELEVATED = 60;
// Shown for a holding with no score row yet (just added; cron hasn't run).
export const COLLECTING_LABEL = "Collecting…";
// Score at or above this counts as the "high" half of each axis.
const AXIS_MID = 50;
const MIN_RADIUS = 7;
const MAX_RADIUS = 22;

export interface QuadrantPoint {
  ticker: string;
  /** Risk score, 0..100, horizontal axis. */
  x: number;
  /** Quality (buy) score, 0..100, vertical axis. */
  y: number;
  trim: number | null;
  /** Position weight as a fraction 0..1 (0 when unpriced). */
  weight: number;
  /** Dot radius in px; area scales with weight. */
  radius: number;
  trimElevated: boolean;
  quadrant: Quadrant;
}

export interface ExcludedHolding {
  ticker: string;
  /** Risk score if a row exists, else null (collecting). */
  risk: number | null;
  /** Trim score if a row exists, else null (collecting). */
  trim: number | null;
  reason: string;
  /** True when the ticker has no score row yet (newly added). */
  collecting: boolean;
}

function classify(buy: number, risk: number): Quadrant {
  const highQuality = buy >= AXIS_MID;
  const highRisk = risk >= AXIS_MID;
  if (highQuality) return highRisk ? "watch" : "core";
  return highRisk ? "review" : "stable";
}

// Area ∝ weight: radius scales with sqrt(weight). Unpriced (weight 0) gets MIN.
function radiusForWeight(weight: number): number {
  const w = Number.isFinite(weight) && weight > 0 ? Math.min(weight, 1) : 0;
  return MIN_RADIUS + Math.sqrt(w) * (MAX_RADIUS - MIN_RADIUS);
}

/**
 * Split a portfolio's holdings into plottable quadrant points (gate-passers,
 * buy !== null) and an excluded list. Excluded covers gate-failers (row exists,
 * buy/risk null) carrying their Risk + Trim + gate reason, and tickers with no
 * score row at all (just added) marked `collecting`. Excluded is sorted by Risk
 * descending; collecting (no Risk) sorts last. `tickers` is the full distinct
 * holdings list so a no-row ticker is surfaced rather than dropped.
 */
export function buildQuadrant(
  tickers: string[],
  scoresByTicker: Record<string, HoldingScore>,
  weightByTicker: Record<string, number>,
): { points: QuadrantPoint[]; excluded: ExcludedHolding[] } {
  const points: QuadrantPoint[] = [];
  const excluded: ExcludedHolding[] = [];
  for (const ticker of tickers) {
    const s = scoresByTicker[ticker];
    if (!s) {
      excluded.push({
        ticker,
        risk: null,
        trim: null,
        reason: COLLECTING_LABEL,
        collecting: true,
      });
      continue;
    }
    if (s.buy === null || s.risk === null) {
      excluded.push({
        ticker: s.ticker,
        risk: s.risk,
        trim: s.trim,
        reason: s.buyGateReason ?? "Not scored yet",
        collecting: false,
      });
      continue;
    }
    const weight = weightByTicker[s.ticker] ?? 0;
    points.push({
      ticker: s.ticker,
      x: s.risk,
      y: s.buy,
      trim: s.trim,
      weight,
      radius: radiusForWeight(weight),
      trimElevated: s.trim !== null && s.trim >= TRIM_ELEVATED,
      quadrant: classify(s.buy, s.risk),
    });
  }
  // Risk desc; nulls (collecting) last.
  excluded.sort((a, b) => (b.risk ?? -1) - (a.risk ?? -1));
  return { points, excluded };
}

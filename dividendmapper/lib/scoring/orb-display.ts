import type { ScoreType } from "./chip-display";

// Orb palette is intentionally distinct from the table chip palette. Arc
// length encodes the score (0-100 → 0-1 of the full circle); colour encodes
// the score type identity, always at the same saturated tone so all three
// rings read as the same "voice" regardless of magnitude.
const STROKE: Record<ScoreType, string> = {
  buy: "#10b981",
  trim: "#f59e0b",
  risk: "#ef4444",
};

// Chip text uses one shade lighter than the arc stroke to clear WCAG AA 4.5:1
// against the 12%-tinted chip background on the dark canvas. Without this,
// axe flagged Risk text (#ef4444) at 4.29:1 — 0.21 short of AA. The arc
// stroke itself stays at the canonical shade so the orb identity reads the
// same. (Tailwind 400 shades: emerald-400, amber-400, red-400.)
const CHIP_TEXT: Record<ScoreType, string> = {
  buy: "#34d399",
  trim: "#fbbf24",
  risk: "#f87171",
};

const GLOW: Record<ScoreType, string> = {
  buy: "rgba(16, 185, 129, 0.45)",
  trim: "rgba(245, 158, 11, 0.45)",
  risk: "rgba(239, 68, 68, 0.45)",
};

export function arcLength(score: number | null): number {
  if (score === null || score === undefined || Number.isNaN(score)) return 0;
  if (score <= 0) return 0;
  if (score >= 100) return 1;
  return score / 100;
}

export function arcStrokeColor(type: ScoreType): string {
  return STROKE[type];
}

export function chipTextColor(type: ScoreType): string {
  return CHIP_TEXT[type];
}

export function arcGlowColor(type: ScoreType): string {
  return GLOW[type];
}

export function formatScoreLabel(
  score: number | null,
  gateReason?: string | null,
): string {
  if (score === null || score === undefined) {
    return gateReason ? "DNQ" : "—";
  }
  return String(Math.round(score));
}

export function orbAriaLabel(
  ticker: string,
  quality: number | null,
  trim: number | null,
  risk: number | null,
): string {
  const part = (label: string, v: number | null) =>
    v === null || v === undefined ? `${label} unavailable` : `${label} ${Math.round(v)}`;
  return `${ticker}: ${part("Quality", quality)}, ${part("Trim", trim)}, ${part("Risk", risk)}`;
}

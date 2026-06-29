/**
 * Year-indexed CAGR for the future-income projection.
 *
 * Step 1: cap rawCagr to [0, +5%] (post-backtest constants, locked).
 * Step 2: fade linearly from the capped value to the long-run 2.5% across
 *   years 3 → 12. Years ≤ 3 return the capped value verbatim; years ≥ 12
 *   return the long-run rate.
 *
 * Constants validated by the historical backtest 2026-06-29; see
 * scripts/audits/projection-backtest-report-20260629.md.
 */
export function projectionCagrForYear(rawCagr: number, t: number): number {
  const capped = Math.max(0, Math.min(0.05, rawCagr));
  const LONG_RUN = 0.025;
  if (t <= 3) return capped;
  if (t >= 12) return LONG_RUN;
  const w = (t - 3) / 9;
  return capped * (1 - w) + LONG_RUN * w;
}

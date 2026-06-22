// Classify a holding's dividend payment cadence from observed user_dividends
// history. Used by IncomeCard on the per-ticker page — equity_scores has no
// frequency column, so we infer from broker-synced payment dates.
//
// Gate: at least 1 year of payment history before we trust the cadence —
// a brand-new holding with 4 quarterly payments by coincidence shouldn't
// be labelled "quarterly" until we've seen the rhythm hold.

const YEAR_MS = 365.25 * 86_400_000;

export type DividendFrequency =
  | "monthly"
  | "quarterly"
  | "semi-annual"
  | "annual";

export function deriveFrequency(
  paymentDates: ReadonlyArray<string>,
  asOf: Date,
): DividendFrequency | null {
  if (paymentDates.length === 0) return null;

  const now = asOf.getTime();
  const cutoff = now - YEAR_MS;

  let oldestMs = Number.POSITIVE_INFINITY;
  let ttmCount = 0;
  for (const d of paymentDates) {
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) continue;
    if (t < oldestMs) oldestMs = t;
    if (t > cutoff && t <= now) ttmCount += 1;
  }

  // Require at least 1 year of observed history.
  if (oldestMs > cutoff) return null;

  if (ttmCount >= 10) return "monthly";
  if (ttmCount === 3 || ttmCount === 4) return "quarterly";
  if (ttmCount === 2) return "semi-annual";
  if (ttmCount === 1) return "annual";
  return null;
}

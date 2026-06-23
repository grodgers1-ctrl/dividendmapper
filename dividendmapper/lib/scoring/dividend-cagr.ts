// 5-year dividend CAGR derived from the FMP per-share dividend stream.
// Compares two annual buckets: TTM (year ending asOf) and the 12 months
// ending 5 years before asOf. Returns null when either bucket is empty —
// the FundamentalsCard then renders a — placeholder rather than a misleading 0.
//
// Uses adjDividend when available (split-adjusted) to avoid step-changes from
// share splits looking like cuts; falls back to dividend.

const YEAR_MS = 365.25 * 86_400_000;
const YEARS = 5;

export interface DividendPayment {
  date: string;
  dividend: number | null;
  adjDividend?: number | null;
}

function sumYearEnding(
  payments: ReadonlyArray<DividendPayment>,
  endMs: number,
): number {
  const startMs = endMs - YEAR_MS;
  let total = 0;
  for (const p of payments) {
    const t = new Date(p.date).getTime();
    if (!Number.isFinite(t)) continue;
    if (t <= startMs || t > endMs) continue;
    const amount = p.adjDividend ?? p.dividend ?? 0;
    if (Number.isFinite(amount)) total += amount;
  }
  return total;
}

export function computeDividendCagr5y(
  payments: ReadonlyArray<DividendPayment>,
  asOf: Date,
): number | null {
  if (payments.length === 0) return null;
  const now = asOf.getTime();
  const recent = sumYearEnding(payments, now);
  const old = sumYearEnding(payments, now - YEARS * YEAR_MS);
  if (recent <= 0 || old <= 0) return null;
  return Math.pow(recent / old, 1 / YEARS) - 1;
}

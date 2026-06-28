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

// Rolling variant: CAGR over an arbitrary window ending at asOfDate.
// Compares two TTM (trailing 12-month) buckets — one ending at asOfDate,
// one ending windowYears earlier — and annualises the ratio. Matches the
// semantics of `computeDividendCagr5y` so quarterly-cadence streams aren't
// thrown off by uneven bucket payment counts at the window edges.
// Returns null when either bucket is empty so callers can render a placeholder.
export function computeDividendCagr(
  dividends: ReadonlyArray<DividendPayment>,
  opts: { windowYears: number; asOfDate: Date },
): number | null {
  const { windowYears, asOfDate } = opts;
  if (dividends.length === 0) return null;
  if (!(windowYears > 0)) return null;
  const asOfMs = asOfDate.getTime();
  if (!Number.isFinite(asOfMs)) return null;

  const recent = sumYearEnding(dividends, asOfMs);
  const old = sumYearEnding(dividends, asOfMs - windowYears * YEAR_MS);
  if (recent <= 0 || old <= 0) return null;
  const ratio = recent / old;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.pow(ratio, 1 / windowYears) - 1;
}

// Pure aggregator for the Income Calendar card on /app/dashboard. Combines
// past-actual dividends (from user_dividends) with future-forecast dividends
// (from equity_scores.next_ex_div_*) into a 12-month rolling window: 6 past
// + current + 5 future = 12 buckets. Each bucket is tagged 'actual' /
// 'partial' / 'forecast' so the UI can style past vs current vs future.
//
// Also returns the next 3 ex-divs across the user's holdings, sorted by
// ex-date ascending, with GBP-equivalent expected payment per row.
//
// FX: the caller supplies a currency → GBP multiplier map (the same one the
// rest of the dashboard uses via ratesToGbpFor). Any currency missing from
// the map is treated as unconvertible — the contribution is silently dropped.

export interface IncomeCalendarHolding {
  ticker: string;
  quantity: number;
}

export interface IncomeCalendarExDiv {
  ex_date: string;          // YYYY-MM-DD
  pay_date: string | null;  // YYYY-MM-DD or null
  amount: number;            // per-share, in native units
  currency: string;          // ISO or 'GBp'/'GBX' for pence
}

export interface IncomeCalendarUserDividend {
  paid_on: string;
  amount: number;
  currency: string;
}

/**
 * 'actual' = a past month, populated from user_dividends (cash already
 * received).
 * 'partial' = the current calendar month, populated from user_dividends only
 * (month-to-date received). Future-pay forecast contributions whose pay_date
 * lands in this month are intentionally excluded — the bar represents cash
 * banked, not run-rate. To show projected total for the current month,
 * compose with the next-3 list.
 * 'forecast' = a future month, populated from holdings × next_ex_div_amount,
 * bucketed by pay_date.
 */
export type IncomeCalendarMonthKind = "actual" | "partial" | "forecast";

export interface IncomeCalendarMonth {
  ym: string;                       // YYYY-MM
  gbp: number;
  kind: IncomeCalendarMonthKind;
}

export interface IncomeCalendarNextEx {
  ticker: string;
  exDate: string;
  payDate: string | null;
  gbp: number;
}

export interface IncomeCalendarResult {
  months: IncomeCalendarMonth[];
  nextThree: IncomeCalendarNextEx[];
}

interface BuildArgs {
  userDividends: IncomeCalendarUserDividend[];
  holdings: IncomeCalendarHolding[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToGbp: Record<string, number>;
  now: Date;
}

const PAST_MONTHS = 6;
const FUTURE_MONTHS = 5;

function ym(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function ymFromIso(iso: string): string {
  // user_dividends.paid_on is YYYY-MM-DD; trust the first 7 chars.
  return iso.slice(0, 7);
}

function shiftMonths(d: Date, delta: number): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
  return out;
}

function convertToGbp(
  amount: number,
  currency: string,
  ratesToGbp: Record<string, number>,
): number | null {
  const rate = ratesToGbp[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  const result = amount * rate;
  return Number.isFinite(result) ? result : null;
}

export function buildIncomeCalendar(args: BuildArgs): IncomeCalendarResult {
  const { userDividends, holdings, exDivByTicker, ratesToGbp, now } = args;

  // 1. Build the 12-bucket window: from now-6mo to now+5mo.
  const start = shiftMonths(now, -PAST_MONTHS);
  const buckets = new Map<string, IncomeCalendarMonth>();
  for (let i = 0; i < PAST_MONTHS + 1 + FUTURE_MONTHS; i++) {
    const d = shiftMonths(start, i);
    const key = ym(d);
    const isCurrent = i === PAST_MONTHS;
    buckets.set(key, {
      ym: key,
      gbp: 0,
      kind: isCurrent ? "partial" : i < PAST_MONTHS ? "actual" : "forecast",
    });
  }

  // 2. Past-actual + current: aggregate user_dividends by paid-on month.
  for (const d of userDividends) {
    const key = ymFromIso(d.paid_on);
    const bucket = buckets.get(key);
    if (!bucket) continue;          // outside the 12-month window
    if (bucket.kind === "forecast") continue;  // user_dividends shouldn't drive future buckets
    const gbp = convertToGbp(d.amount, d.currency, ratesToGbp);
    if (gbp === null) continue;
    bucket.gbp += gbp;
  }

  // 3. Future-forecast: aggregate ex-divs by pay-date month × quantity.
  for (const h of holdings) {
    const ex = exDivByTicker[h.ticker];
    if (!ex || !ex.pay_date) continue;
    const key = ymFromIso(ex.pay_date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.kind !== "forecast") continue;  // pay-date in past or current = skip
    const perShareGbp = convertToGbp(ex.amount, ex.currency, ratesToGbp);
    if (perShareGbp === null) continue;
    const totalGbp = perShareGbp * h.quantity;
    if (!Number.isFinite(totalGbp) || totalGbp <= 0) continue;
    bucket.gbp += totalGbp;
  }

  // 4. Next 3 ex-divs across holdings, sorted ascending.
  const todayIso = now.toISOString().slice(0, 10);
  const candidates: IncomeCalendarNextEx[] = [];
  for (const h of holdings) {
    const ex = exDivByTicker[h.ticker];
    if (!ex || !ex.ex_date) continue;
    if (ex.ex_date < todayIso) continue;
    const perShareGbp = convertToGbp(ex.amount, ex.currency, ratesToGbp);
    if (perShareGbp === null) continue;
    const totalGbp = perShareGbp * h.quantity;
    if (!Number.isFinite(totalGbp) || totalGbp <= 0) continue;
    candidates.push({
      ticker: h.ticker,
      exDate: ex.ex_date,
      payDate: ex.pay_date,
      gbp: totalGbp,
    });
  }
  candidates.sort((a, b) => (a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0));
  const nextThree = candidates.slice(0, 3);

  // Preserve insertion order — buckets is built start → end.
  return {
    months: Array.from(buckets.values()),
    nextThree,
  };
}

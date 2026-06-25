// Pure aggregator for the Income Calendar — v2.
// Combines past-actual dividends (user_dividends) with future-forecast
// dividends (equity_scores.next_ex_div_*) into a rolling window:
//   6 past + current (partial) + 12 future = 19 buckets.
//
// v2 additions vs v1:
//   - `segments` array on each month (Slice B layers more segment kinds).
//   - `wrapperFilter` parameter (cascades to per-month aggregation).
//   - `locale` parameter (drives primaryCurrency on the result).
//   - Wrapper-aware tagging on userDividends + holdings.
//
// Back-compat: `gbp` + `kind` on each month are derived from segments and
// kept until v2.1 (the dashboard lite card still reads them).
//
// FX: caller supplies a currency → primary-currency map. Same shape as
// today's ratesToGbpFor helper; v2 callers may pass a ratesToUsd map when
// locale='us'. Field name stays `ratesToGbp` for now (rename deferred to v2.1).

export type Wrapper =
  | "isa" | "sipp" | "gia"
  | "401k" | "ira" | "roth_ira"
  | "brokerage";

export type Locale = "uk" | "us";

export type SegmentKind =
  | "actual"
  | "partial"
  | "confirmed-forecast"
  | "projected-cadence"   // Slice B
  | "projected-growth"    // Slice B
  | "growth-clipped";     // Slice B

export interface IncomeCalendarHolding {
  ticker: string;
  quantity: number;
  wrapper: Wrapper;
  created_at: string;
}

export interface IncomeCalendarExDiv {
  ex_date: string;
  pay_date: string | null;
  amount: number;
  currency: string;
}

export interface IncomeCalendarUserDividend {
  paid_on: string;
  amount: number;
  currency: string;
  wrapper: Wrapper;
}

export interface IncomeCalendarSegment {
  primary: number;
  kind: SegmentKind;
}

export type IncomeCalendarMonthKind = SegmentKind;

export interface IncomeCalendarMonth {
  ym: string;
  segments: IncomeCalendarSegment[];
  gbp: number;
  kind: IncomeCalendarMonthKind;
}

export interface IncomeCalendarNextEx {
  ticker: string;
  exDate: string;
  payDate: string | null;
  gbp: number;
  wrapper: Wrapper;
}

export interface IncomeCalendarResult {
  months: IncomeCalendarMonth[];
  nextThree: IncomeCalendarNextEx[];
  primaryCurrency: "GBP" | "USD";
}

export type WrapperFilter = "all" | Wrapper;

interface BuildArgs {
  userDividends: IncomeCalendarUserDividend[];
  holdings: IncomeCalendarHolding[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToGbp: Record<string, number>;
  now: Date;
  locale: Locale;
  wrapperFilter?: WrapperFilter;
}

const PAST_MONTHS = 6;
const FUTURE_MONTHS = 12;

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonths(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}

function convertToPrimary(
  amount: number,
  currency: string,
  ratesToGbp: Record<string, number>,
): number | null {
  const rate = ratesToGbp[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  const result = amount * rate;
  return Number.isFinite(result) ? result : null;
}

function passesWrapperFilter(wrapper: Wrapper, filter: WrapperFilter): boolean {
  return filter === "all" || filter === wrapper;
}

function pushSegment(month: IncomeCalendarMonth, kind: SegmentKind, primary: number): void {
  const existing = month.segments.find((s) => s.kind === kind);
  if (existing) existing.primary += primary;
  else month.segments.push({ kind, primary });
}

function deriveDominant(month: IncomeCalendarMonth): void {
  // Sum primary → gbp; pick dominant kind (largest segment) for back-compat
  // consumers. Default kind (set at bucket creation) is retained when there
  // are no segments.
  let total = 0;
  let dominant: SegmentKind = month.kind;
  let dominantPrimary = -1;
  for (const seg of month.segments) {
    total += seg.primary;
    if (seg.primary > dominantPrimary) {
      dominant = seg.kind;
      dominantPrimary = seg.primary;
    }
  }
  month.gbp = total;
  if (month.segments.length > 0) month.kind = dominant;
}

export function buildIncomeCalendar(args: BuildArgs): IncomeCalendarResult {
  const {
    userDividends,
    holdings,
    exDivByTicker,
    ratesToGbp,
    now,
    locale,
    wrapperFilter = "all",
  } = args;

  const primaryCurrency: "GBP" | "USD" = locale === "us" ? "USD" : "GBP";

  const start = shiftMonths(now, -PAST_MONTHS);
  const buckets = new Map<string, IncomeCalendarMonth>();
  for (let i = 0; i < PAST_MONTHS + 1 + FUTURE_MONTHS; i++) {
    const d = shiftMonths(start, i);
    const key = ym(d);
    const isCurrent = i === PAST_MONTHS;
    buckets.set(key, {
      ym: key,
      segments: [],
      gbp: 0,
      kind: isCurrent ? "partial" : i < PAST_MONTHS ? "actual" : "confirmed-forecast",
    });
  }

  for (const d of userDividends) {
    if (!passesWrapperFilter(d.wrapper, wrapperFilter)) continue;
    const key = ymFromIso(d.paid_on);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.kind !== "actual" && bucket.kind !== "partial") continue;
    const primary = convertToPrimary(d.amount, d.currency, ratesToGbp);
    if (primary === null) continue;
    pushSegment(bucket, bucket.kind === "partial" ? "partial" : "actual", primary);
  }

  for (const h of holdings) {
    if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
    const ex = exDivByTicker[h.ticker];
    if (!ex || !ex.pay_date) continue;
    const key = ymFromIso(ex.pay_date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.kind !== "confirmed-forecast") continue;
    const perShare = convertToPrimary(ex.amount, ex.currency, ratesToGbp);
    if (perShare === null) continue;
    const total = perShare * h.quantity;
    if (!Number.isFinite(total) || total <= 0) continue;
    pushSegment(bucket, "confirmed-forecast", total);
  }

  for (const bucket of buckets.values()) deriveDominant(bucket);

  const todayIso = now.toISOString().slice(0, 10);
  const candidates: IncomeCalendarNextEx[] = [];
  for (const h of holdings) {
    if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
    const ex = exDivByTicker[h.ticker];
    if (!ex || !ex.ex_date) continue;
    if (ex.ex_date < todayIso) continue;
    const perShare = convertToPrimary(ex.amount, ex.currency, ratesToGbp);
    if (perShare === null) continue;
    const total = perShare * h.quantity;
    if (!Number.isFinite(total) || total <= 0) continue;
    candidates.push({
      ticker: h.ticker,
      exDate: ex.ex_date,
      payDate: ex.pay_date,
      gbp: total,
      wrapper: h.wrapper,
    });
  }
  candidates.sort((a, b) => (a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0));

  return {
    months: Array.from(buckets.values()),
    nextThree: candidates.slice(0, 3),
    primaryCurrency,
  };
}

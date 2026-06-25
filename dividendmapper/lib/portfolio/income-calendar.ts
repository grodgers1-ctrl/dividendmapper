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
  /** Optional ticker scoring symbol — used to dedupe back-projected segments
   * for the same ticker in the same month. Older rows may not have it. */
  ticker?: string;
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
  gbp: number;                // total in primary currency
  wrapper: Wrapper;
  // Slice A polish: drilldown read these to render "1.98 GBp × 50 = £0.99"
  // instead of "99 GBP £99" (same number twice with wrong native unit).
  perShareNative: number;     // per-share amount in its native currency
  nativeCurrency: string;     // e.g. "GBp", "USD"
  quantity: number;           // holding quantity
}

// Per-payment row consumed by the drilldown panel. One entry per
// (holding × payment); a month may have many. Status drives the colored pill
// (Received / Declared / Estimated). Frequency comes from the cron's
// projected_cadence cache. quantity is omitted for actuals (we only know the
// cash total, not the per-share × N decomposition).
export interface IncomeCalendarPayment {
  ticker: string;
  name?: string;
  exDate: string;
  payDate: string | null;
  perShareNative: number;
  nativeCurrency: string;
  quantity?: number;
  primaryAmount: number;
  wrapper: Wrapper;
  status: "received" | "declared" | "estimated";
  frequency?: string;
}

export interface IncomeCalendarResult {
  months: IncomeCalendarMonth[];
  nextThree: IncomeCalendarNextEx[];
  primaryCurrency: "GBP" | "USD";
  /** Drilldown lookup keyed by YYYY-MM. All known payments (received / declared
   * / estimated) bucketed by paid_on (actuals) or pay_date (forecasts). */
  paymentsByMonth: Record<string, IncomeCalendarPayment[]>;
}

export type WrapperFilter = "all" | Wrapper;

export interface ProjectedPaymentRow {
  ex_date: string;
  pay_date: string;
  per_share_amount: number;
  currency: string;
  confidence: "cadence" | "cadence+growth" | "growth-clipped" | "growth-unknown";
}

interface BuildArgs {
  userDividends: IncomeCalendarUserDividend[];
  holdings: IncomeCalendarHolding[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToGbp: Record<string, number>;
  now: Date;
  locale: Locale;
  wrapperFilter?: WrapperFilter;
  /** Optional per-ticker metadata for the drilldown panel. */
  nameByTicker?: Record<string, string>;
  cadenceByTicker?: Record<string, string>;
  // Slice B projection caches. Forward fills empty future buckets that don't
  // already carry a confirmed-forecast segment; backward back-fills past
  // buckets gated on holdings.created_at + a 6mo floor, deduped vs any
  // user_dividends in the same month.
  projectedNext12mByTicker?: Record<string, ProjectedPaymentRow[]>;
  projectedHistorical12mByTicker?: Record<string, ProjectedPaymentRow[]>;
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

function confidenceToSegmentKind(c: ProjectedPaymentRow["confidence"]): SegmentKind {
  switch (c) {
    case "cadence":         return "projected-cadence";
    case "cadence+growth":  return "projected-growth";
    case "growth-clipped":  return "growth-clipped";
    case "growth-unknown":  return "projected-cadence";
  }
}

function dateMinusMonths(d: Date, m: number): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
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
    nameByTicker = {},
    cadenceByTicker = {},
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

  const paymentsByMonth: Record<string, IncomeCalendarPayment[]> = {};
  const actualTickerMonths = new Set<string>(); // dedupe key for back-projection
  function pushPayment(p: IncomeCalendarPayment, ym: string) {
    if (!paymentsByMonth[ym]) paymentsByMonth[ym] = [];
    paymentsByMonth[ym].push(p);
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
    const dedupeTicker = d.ticker ?? "*";
    actualTickerMonths.add(`${dedupeTicker}:${key}`);
    pushPayment(
      {
        ticker: d.ticker ?? "",
        name: d.ticker ? nameByTicker[d.ticker] : undefined,
        exDate: d.paid_on,
        payDate: d.paid_on,
        perShareNative: d.amount,
        nativeCurrency: d.currency,
        primaryAmount: primary,
        wrapper: d.wrapper,
        status: "received",
        frequency: d.ticker ? cadenceByTicker[d.ticker] : undefined,
      },
      key,
    );
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
    pushPayment(
      {
        ticker: h.ticker,
        name: nameByTicker[h.ticker],
        exDate: ex.ex_date,
        payDate: ex.pay_date,
        perShareNative: ex.amount,
        nativeCurrency: ex.currency,
        quantity: h.quantity,
        primaryAmount: total,
        wrapper: h.wrapper,
        status: "declared",
        frequency: cadenceByTicker[h.ticker],
      },
      key,
    );
  }

  // Slice B: forward projection. Fills future buckets with this ticker's
  // projected payments. Per-ticker `confirmedPayKey` check above blocks the
  // same ticker from contributing both confirmed and projected for the same
  // month. Other tickers' confirmed-forecast segments DO NOT block this
  // ticker's projection (Bug A 2026-06-25 fix).
  if (args.projectedNext12mByTicker) {
    for (const h of holdings) {
      if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
      const confirmedPayKey = (() => {
        const ex = exDivByTicker[h.ticker];
        return ex?.pay_date ? ymFromIso(ex.pay_date) : null;
      })();
      const rows = args.projectedNext12mByTicker[h.ticker] ?? [];
      for (const r of rows) {
        if (!r.pay_date) continue;
        const key = ymFromIso(r.pay_date);
        if (confirmedPayKey && key === confirmedPayKey) continue;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        if (bucket.kind !== "confirmed-forecast") continue;
        const perShare = convertToPrimary(r.per_share_amount, r.currency, ratesToGbp);
        if (perShare === null) continue;
        const total = perShare * h.quantity;
        if (!Number.isFinite(total) || total <= 0) continue;
        pushSegment(bucket, confidenceToSegmentKind(r.confidence), total);
        pushPayment(
          {
            ticker: h.ticker,
            name: nameByTicker[h.ticker],
            exDate: r.ex_date,
            payDate: r.pay_date,
            perShareNative: r.per_share_amount,
            nativeCurrency: r.currency,
            quantity: h.quantity,
            primaryAmount: total,
            wrapper: h.wrapper,
            status: "estimated",
            frequency: cadenceByTicker[h.ticker],
          },
          key,
        );
      }
    }
  }

  // Slice B: backward projection — per-user gated on holdings.created_at,
  // with a 6mo floor so we don't fabricate ancient history for a brand-new
  // holding. Dedupe vs user_dividends by skipping months that already have
  // an 'actual' segment.
  if (args.projectedHistorical12mByTicker) {
    const sixMoFloorIso = dateMinusMonths(now, 6);
    for (const h of holdings) {
      if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
      const createdAtIso = (h.created_at ?? sixMoFloorIso).slice(0, 10);
      const floorIso = createdAtIso > sixMoFloorIso ? createdAtIso : sixMoFloorIso;
      const rows = args.projectedHistorical12mByTicker[h.ticker] ?? [];
      for (const r of rows) {
        if (r.ex_date < floorIso) continue;
        const key = ymFromIso(r.ex_date);
        const bucket = buckets.get(key);
        if (!bucket) continue;
        if (bucket.kind !== "actual") continue;
        // Per-ticker dedupe vs received actuals: if this ticker has an actual
        // user_dividends row in the same month, skip the projection. Untickered
        // actuals (legacy CSV without ticker_scoring) still block the whole
        // month — matches Slice B behavior for that case.
        if (
          actualTickerMonths.has(`${h.ticker}:${key}`) ||
          actualTickerMonths.has(`*:${key}`)
        ) continue;
        const perShare = convertToPrimary(r.per_share_amount, r.currency, ratesToGbp);
        if (perShare === null) continue;
        const total = perShare * h.quantity;
        if (!Number.isFinite(total) || total <= 0) continue;
        pushSegment(bucket, confidenceToSegmentKind(r.confidence), total);
        pushPayment(
          {
            ticker: h.ticker,
            name: nameByTicker[h.ticker],
            exDate: r.ex_date,
            payDate: r.pay_date,
            perShareNative: r.per_share_amount,
            nativeCurrency: r.currency,
            quantity: h.quantity,
            primaryAmount: total,
            wrapper: h.wrapper,
            status: "estimated",
            frequency: cadenceByTicker[h.ticker],
          },
          key,
        );
      }
    }
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
      perShareNative: ex.amount,
      nativeCurrency: ex.currency,
      quantity: h.quantity,
    });
  }
  candidates.sort((a, b) => (a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0));

  // Sort each month's payments by ex-date so drilldown rows read chronologically.
  for (const ym of Object.keys(paymentsByMonth)) {
    paymentsByMonth[ym].sort((a, b) =>
      a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0,
    );
  }

  return {
    months: Array.from(buckets.values()),
    nextThree: candidates.slice(0, 3),
    primaryCurrency,
    paymentsByMonth,
  };
}

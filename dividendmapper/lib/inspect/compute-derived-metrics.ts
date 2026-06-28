// Derived-metric helpers for the Inspect page. Pure functions over FMP-shaped
// quarterly statements + daily price/dividend streams. All series are emitted
// newest-first to match the upstream FMP convention, with null sentinels for
// missing/insufficient data so callers can render a — placeholder rather than
// a misleading 0.

import { computeDividendCagr, type DividendPayment } from '../scoring/dividend-cagr';

type QuarterlyRow = { date: string };
type CashFlowRow = QuarterlyRow & { freeCashFlow: number; dividendsPaid: number };
type IncomeRow = QuarterlyRow & {
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
};

export type DerivedPoint = { at: string; raw: number | null };

function rollingTtm<R extends QuarterlyRow>(
  rows: ReadonlyArray<R>,
  pick: (r: R) => number,
): Array<{ at: string; ttm: number }> {
  // rows are newest-first (FMP convention). Emit one TTM point per quarter
  // where 4 prior quarters exist.
  const out: Array<{ at: string; ttm: number }> = [];
  for (let i = 0; i + 3 < rows.length; i++) {
    const window = rows.slice(i, i + 4);
    const ttm = window.reduce((s, r) => s + pick(r), 0);
    out.push({ at: rows[i].date, ttm });
  }
  return out;
}

export function computeFcfPayoutTtm(cashFlow: ReadonlyArray<CashFlowRow>): DerivedPoint[] {
  const fcfTtm = rollingTtm(cashFlow, (r) => r.freeCashFlow);
  const divsTtm = rollingTtm(cashFlow, (r) => Math.abs(r.dividendsPaid));
  return fcfTtm.map((f, i) => ({
    at: f.at,
    raw: f.ttm > 0 ? divsTtm[i].ttm / f.ttm : null,
  }));
}

export function computeFcfGrowthYoy(cashFlow: ReadonlyArray<CashFlowRow>): DerivedPoint[] {
  const ttm = rollingTtm(cashFlow, (r) => r.freeCashFlow);
  const out: DerivedPoint[] = [];
  for (let i = 0; i + 4 < ttm.length; i++) {
    const cur = ttm[i].ttm;
    const prior = ttm[i + 4].ttm;
    out.push({
      at: ttm[i].at,
      raw: prior > 0 && Number.isFinite(cur / prior) ? (cur - prior) / prior : null,
    });
  }
  return out;
}

export type MarginPoint = {
  at: string;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
};

export function computeMarginsTtm(income: ReadonlyArray<IncomeRow>): MarginPoint[] {
  const rev = rollingTtm(income, (r) => r.revenue);
  const gp = rollingTtm(income, (r) => r.grossProfit);
  const op = rollingTtm(income, (r) => r.operatingIncome);
  const ni = rollingTtm(income, (r) => r.netIncome);
  return rev.map((r, i) => {
    const denom = r.ttm;
    const safe = (v: number): number | null => (denom > 0 ? v / denom : null);
    return {
      at: r.at,
      grossMargin: safe(gp[i].ttm),
      operatingMargin: safe(op[i].ttm),
      netMargin: safe(ni[i].ttm),
    };
  });
}

function lastDayOfMonth(year: number, month1: number): string {
  // month1 is 1-12; last day = day 0 of next month
  const d = new Date(Date.UTC(year, month1, 0));
  return d.toISOString().slice(0, 10);
}

function monthRange(fromMonth: string, toMonth: string): Array<{ year: number; month: number }> {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  const out: Array<{ year: number; month: number }> = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function computeMonthlyYieldSeries(opts: {
  closes: ReadonlyArray<{ date: string; close: number }>;
  dividends: ReadonlyArray<DividendPayment>;
  fromMonth: string; // "YYYY-MM"
  toMonth: string;
}): DerivedPoint[] {
  const months = monthRange(opts.fromMonth, opts.toMonth);
  // Pre-sort closes newest-first once; per-month picker just takes the first
  // entry on-or-before the month-end timestamp.
  const closesDesc = [...opts.closes].sort((a, b) => b.date.localeCompare(a.date));
  return months.map(({ year, month }) => {
    const at = lastDayOfMonth(year, month);
    const atMs = new Date(at).getTime();
    const yearAgoMs = atMs - YEAR_MS;
    const ttmDivs = opts.dividends.reduce((sum, d) => {
      const t = new Date(d.date).getTime();
      if (!Number.isFinite(t) || t <= yearAgoMs || t > atMs) return sum;
      const amount = d.adjDividend ?? d.dividend ?? 0;
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const close = closesDesc.find((c) => c.date <= at)?.close;
    return {
      at,
      raw: close && close > 0 ? ttmDivs / close : null,
    };
  });
}

export type DgrPoint = { at: string; dgr3y: number | null; dgr5y: number | null };

export function computeMonthlyDgrSeries(opts: {
  dividends: ReadonlyArray<DividendPayment>;
  fromMonth: string;
  toMonth: string;
}): DgrPoint[] {
  const months = monthRange(opts.fromMonth, opts.toMonth);
  return months.map(({ year, month }) => {
    const at = lastDayOfMonth(year, month);
    const asOfDate = new Date(at);
    return {
      at,
      dgr3y: computeDividendCagr(opts.dividends, { windowYears: 3, asOfDate }),
      dgr5y: computeDividendCagr(opts.dividends, { windowYears: 5, asOfDate }),
    };
  });
}

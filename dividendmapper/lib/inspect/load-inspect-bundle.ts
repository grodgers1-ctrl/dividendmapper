import {
  getRatiosQuarterly,
  getKeyMetricsQuarterly,
  getCashFlowStatementQuarterly,
  getIncomeStatementQuarterly,
  getDividends,
} from '../scoring/fmp-client';
import {
  computeFcfPayoutTtm,
  computeFcfGrowthYoy,
  computeMarginsTtm,
  computeMonthlyYieldSeries,
  computeMonthlyDgrSeries,
} from './compute-derived-metrics';
import { inspectAdminClient } from './supabase-admin';
import type {
  CachedMonthlyRow,
  CachedQuarterlyRow,
  InspectBundle,
  InspectLoadResult,
} from './types';

const UNCOVERABLE = Symbol('uncoverable');
const OTHER_ERR = Symbol('other');

function isUncoverable(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 422;
  }
  return false;
}

async function safeFetch<T>(p: Promise<T>): Promise<T | typeof UNCOVERABLE | typeof OTHER_ERR> {
  try {
    return await p;
  } catch (e) {
    return isUncoverable(e) ? UNCOVERABLE : OTHER_ERR;
  }
}

function rangeYears(rows: Array<{ observed_at: string }>): number {
  if (rows.length < 2) return 0;
  const ms =
    new Date(rows[0].observed_at).getTime() -
    new Date(rows[rows.length - 1].observed_at).getTime();
  return ms / (365 * 24 * 60 * 60 * 1000);
}

export async function loadInspectBundle(ticker: string): Promise<InspectLoadResult> {
  const [ratios, key, cash, income, dividends] = await Promise.all([
    safeFetch(getRatiosQuarterly(ticker)),
    safeFetch(getKeyMetricsQuarterly(ticker)),
    safeFetch(getCashFlowStatementQuarterly(ticker)),
    safeFetch(getIncomeStatementQuarterly(ticker)),
    safeFetch(getDividends(ticker, 40)),
  ]);

  if (ratios === UNCOVERABLE && key === UNCOVERABLE && cash === UNCOVERABLE && income === UNCOVERABLE) {
    return { status: 'uncoverable' };
  }

  const ratiosArr: any[] = Array.isArray(ratios) ? (ratios as any[]) : [];
  const keyArr: any[] = Array.isArray(key) ? (key as any[]) : [];
  const cashArr: any[] = Array.isArray(cash) ? (cash as any[]) : [];
  const incomeArr: any[] = Array.isArray(income) ? (income as any[]) : [];
  const divArr: any[] = Array.isArray(dividends) ? (dividends as any[]) : [];

  const keyByDate = new Map(keyArr.map((r: any) => [r.date, r]));
  const fcfPayout = new Map(computeFcfPayoutTtm(cashArr as any).map(p => [p.at, p.raw]));
  const fcfGrowth = new Map(computeFcfGrowthYoy(cashArr as any).map(p => [p.at, p.raw]));
  const margins = new Map(computeMarginsTtm(incomeArr as any).map(p => [p.at, p]));

  const quarterly: CachedQuarterlyRow[] = ratiosArr
    .map((r: any): CachedQuarterlyRow => {
      const k = keyByDate.get(r.date) ?? {};
      const m = margins.get(r.date);
      // FMP renamed several fields in 2025: priceEarningsRatio ->
      // priceToEarningsRatio, interestCoverage -> interestCoverageRatio,
      // priceToFreeCashFlowsRatio -> priceToFreeCashFlowRatio,
      // roic -> returnOnInvestedCapital. Read both for backwards-compat in
      // case FMP serves an older response from cache.
      // Note: P/FCF lives on the RATIOS endpoint, not key-metrics. The
      // key-metrics endpoint only exposes freeCashFlowYield / evToFreeCashFlow.
      const pe = r.priceToEarningsRatio ?? r.priceEarningsRatio ?? null;
      const interestCoverage =
        r.interestCoverageRatio ?? r.interestCoverage ?? null;
      const pFcf =
        r.priceToFreeCashFlowRatio ??
        r.priceToFreeCashFlowsRatio ??
        (k as any).priceToFreeCashFlowRatio ??
        (k as any).priceToFreeCashFlowsRatio ??
        null;
      const roic =
        (k as any).returnOnInvestedCapital ?? (k as any).roic ?? null;
      return {
        ticker,
        observed_at: r.date,
        pe,
        p_fcf: pFcf,
        net_debt_ebitda: (k as any).netDebtToEBITDA ?? null,
        interest_coverage: interestCoverage,
        fcf_payout: fcfPayout.get(r.date) ?? null,
        fcf_growth_yoy: fcfGrowth.get(r.date) ?? null,
        roic,
        gross_margin: m?.grossMargin ?? null,
        operating_margin: m?.operatingMargin ?? null,
        net_margin: m?.netMargin ?? null,
      };
    })
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));

  const sb = inspectAdminClient();

  // Monthly window: 10y of month-ends ending at the most-recent quarter (or today if no quarterly).
  const todayIso = quarterly[0]?.observed_at ?? new Date().toISOString().slice(0, 10);
  const today = new Date(todayIso);
  const fromYear = today.getUTCFullYear() - 10;
  const fromMonth = `${fromYear}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const toMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;

  // Pull closes from ticker_price_history (10y of monthly samples is plenty for month-end picks).
  const { data: priceRows } = await sb
    .from('ticker_price_history')
    .select('trade_date, close')
    .eq('ticker', ticker)
    .gte('trade_date', `${fromYear - 1}-01-01`)
    .order('trade_date', { ascending: false });

  const closes = (priceRows ?? []).map((r: any) => ({
    date: r.trade_date as string,
    close: Number(r.close),
  }));

  const yields = computeMonthlyYieldSeries({ closes, dividends: divArr, fromMonth, toMonth });
  const dgr = computeMonthlyDgrSeries({ dividends: divArr, fromMonth, toMonth });

  const monthly: CachedMonthlyRow[] = yields
    .map((y, i): CachedMonthlyRow => ({
      ticker,
      observed_at: y.at,
      dividend_yield: y.raw,
      dgr_3y: dgr[i]?.dgr3y ?? null,
      dgr_5y: dgr[i]?.dgr5y ?? null,
    }))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));

  if (quarterly.length) {
    const { error } = await sb
      .from('ticker_inspect_quarterly')
      .upsert(quarterly, { onConflict: 'ticker,observed_at' });
    if (error) throw error;
  }
  if (monthly.length) {
    const { error } = await sb
      .from('ticker_inspect_monthly')
      .upsert(monthly, { onConflict: 'ticker,observed_at' });
    if (error) throw error;
  }

  const bundle: InspectBundle = {
    ticker,
    quarterly,
    monthly,
    rangeYearsQuarterly: rangeYears(quarterly),
    rangeYearsMonthly: rangeYears(monthly),
  };
  return { status: 'ok', bundle, cacheHit: false };
}

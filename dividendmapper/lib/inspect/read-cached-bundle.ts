import { inspectAdminClient } from './supabase-admin';
import type { CachedMonthlyRow, CachedQuarterlyRow, InspectBundle } from './types';

const FRESH_DAYS = 30;
const MIN_QUARTERLY_ROWS = 12;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function rangeYears(rows: Array<{ observed_at: string }>): number {
  if (rows.length < 2) return 0;
  const newest = new Date(rows[0].observed_at).getTime();
  const oldest = new Date(rows[rows.length - 1].observed_at).getTime();
  return (newest - oldest) / YEAR_MS;
}

export async function readCachedBundle(ticker: string): Promise<InspectBundle | null> {
  const sb = inspectAdminClient();
  const [{ data: qData }, { data: mData }] = await Promise.all([
    sb.from('ticker_inspect_quarterly').select('*').eq('ticker', ticker).order('observed_at', { ascending: false }),
    sb.from('ticker_inspect_monthly').select('*').eq('ticker', ticker).order('observed_at', { ascending: false }),
  ]);

  const quarterly = (qData as Array<CachedQuarterlyRow & { refreshed_at?: string }> | null) ?? [];
  const monthly = (mData as CachedMonthlyRow[] | null) ?? [];

  if (quarterly.length < MIN_QUARTERLY_ROWS) return null;

  const maxRefreshed = quarterly.reduce(
    (acc, r) => Math.max(acc, r.refreshed_at ? new Date(r.refreshed_at).getTime() : 0),
    0,
  );
  const ageMs = Date.now() - maxRefreshed;
  if (ageMs > FRESH_DAYS * 24 * 60 * 60 * 1000) return null;

  // strip refreshed_at from the returned shape (it's a cache-metadata column, not a domain field)
  const quarterlyClean: CachedQuarterlyRow[] = quarterly.map(({ refreshed_at: _r, ...rest }) => rest as CachedQuarterlyRow);

  return {
    ticker,
    quarterly: quarterlyClean,
    monthly,
    rangeYearsQuarterly: rangeYears(quarterlyClean),
    rangeYearsMonthly: rangeYears(monthly),
  };
}

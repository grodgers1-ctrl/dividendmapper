import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CachedQuarterlyRow, CachedMonthlyRow } from '../types';

vi.mock('../supabase-admin', () => ({ inspectAdminClient: vi.fn() }));

import * as sb from '../supabase-admin';
import { readCachedBundle } from '../read-cached-bundle';

function makeQuarterlyRow(observedAt: string, refreshedAt: string): CachedQuarterlyRow & { refreshed_at: string } {
  return {
    ticker: 'MSFT',
    observed_at: observedAt,
    pe: 25, p_fcf: 28, net_debt_ebitda: 1.2, interest_coverage: 18,
    fcf_payout: 0.4, fcf_growth_yoy: 0.1, roic: 0.2,
    gross_margin: 0.6, operating_margin: 0.4, net_margin: 0.3,
    refreshed_at: refreshedAt,
  };
}

function makeMonthlyRow(observedAt: string): CachedMonthlyRow {
  return { ticker: 'MSFT', observed_at: observedAt, dividend_yield: 0.025, dgr_3y: 0.1, dgr_5y: 0.1 };
}

function buildSb(quarterly: any[], monthly: any[]) {
  const select = (rows: any[]) => ({
    eq: () => ({
      order: () => Promise.resolve({ data: rows, error: null }),
    }),
  });
  return {
    from: (table: string) => ({
      select: () => {
        if (table === 'ticker_inspect_quarterly') return select(quarterly);
        if (table === 'ticker_inspect_monthly') return select(monthly);
        throw new Error(`unexpected table ${table}`);
      },
    }),
  };
}

beforeEach(() => vi.resetAllMocks());

describe('readCachedBundle', () => {
  it('returns the bundle when cache is fresh and has >=12 quarterly rows', async () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const quarterly = Array.from({ length: 12 }, (_, i) => {
      const year = 2024 - Math.floor(i / 4);
      const month = ['12', '09', '06', '03'][i % 4];
      return makeQuarterlyRow(`${year}-${month}-30`, recent);
    });
    const monthly = Array.from({ length: 36 }, (_, i) => {
      const month = String(((11 - (i % 12)) + 1)).padStart(2, '0');
      const year = 2024 - Math.floor(i / 12);
      return makeMonthlyRow(`${year}-${month}-28`);
    });
    (sb.inspectAdminClient as any).mockReturnValue(buildSb(quarterly, monthly));

    const out = await readCachedBundle('MSFT');
    expect(out).not.toBeNull();
    expect(out!.ticker).toBe('MSFT');
    expect(out!.quarterly).toHaveLength(12);
    expect(out!.monthly).toHaveLength(36);
    expect(out!.rangeYearsQuarterly).toBeGreaterThan(2);
  });

  it('returns null when quarterly has < 12 rows', async () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const quarterly = Array.from({ length: 11 }, (_, i) =>
      makeQuarterlyRow(`2024-${String(12 - i).padStart(2, '0')}-30`, recent),
    );
    (sb.inspectAdminClient as any).mockReturnValue(buildSb(quarterly, []));

    const out = await readCachedBundle('MSFT');
    expect(out).toBeNull();
  });

  it('returns null when cache is stale (>30 days)', async () => {
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const quarterly = Array.from({ length: 12 }, (_, i) =>
      makeQuarterlyRow(`2024-${String(12 - (i % 12)).padStart(2, '0')}-30`, stale),
    );
    (sb.inspectAdminClient as any).mockReturnValue(buildSb(quarterly, []));

    const out = await readCachedBundle('MSFT');
    expect(out).toBeNull();
  });

  it('returns null when quarterly is missing', async () => {
    (sb.inspectAdminClient as any).mockReturnValue(buildSb([], []));
    const out = await readCachedBundle('MSFT');
    expect(out).toBeNull();
  });
});

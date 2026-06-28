import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InspectLoadResult } from '../types';

// Mocks must be hoisted; declare before importing the SUT.
vi.mock('../../scoring/fmp-client', () => ({
  getRatiosQuarterly: vi.fn(),
  getKeyMetricsQuarterly: vi.fn(),
  getCashFlowStatementQuarterly: vi.fn(),
  getIncomeStatementQuarterly: vi.fn(),
  getDividends: vi.fn(),
}));

vi.mock('../supabase-admin', () => ({
  inspectAdminClient: vi.fn(),
}));

import * as fmp from '../../scoring/fmp-client';
import * as sb from '../supabase-admin';
import { loadInspectBundle } from '../load-inspect-bundle';

beforeEach(() => {
  vi.resetAllMocks();
});

function makeChainedSelect(rows: any[]) {
  // Builds a chain compatible with the loader's price-history read:
  // sb.from('ticker_price_history').select(...).eq(...).gte(...).order(...)
  const out: any = {
    select: () => out,
    eq: () => out,
    gte: () => out,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return out;
}

describe('loadInspectBundle', () => {
  it('returns "uncoverable" when FMP returns 422 across the four fundamentals endpoints', async () => {
    (fmp.getRatiosQuarterly as any).mockRejectedValue({ status: 422 });
    (fmp.getKeyMetricsQuarterly as any).mockRejectedValue({ status: 422 });
    (fmp.getCashFlowStatementQuarterly as any).mockRejectedValue({ status: 422 });
    (fmp.getIncomeStatementQuarterly as any).mockRejectedValue({ status: 422 });
    (fmp.getDividends as any).mockResolvedValue([]);

    const res: InspectLoadResult = await loadInspectBundle('ZZZ.FAKE');
    expect(res.status).toBe('uncoverable');
  });

  it('assembles a bundle with quarterly + monthly rows and persists them', async () => {
    // 40 quarters of synthetic data: newest-first FMP convention.
    function quarterDate(i: number) {
      const yearsAgo = Math.floor(i / 4);
      const year = 2024 - yearsAgo;
      const monthIdx = 3 - (i % 4); // 3,2,1,0
      const months = [12, 9, 6, 3];
      const month = months[monthIdx];
      const day = month === 3 ? 31 : 30;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const quarters = Array.from({ length: 40 }, (_, i) => ({ date: quarterDate(i) }));

    (fmp.getRatiosQuarterly as any).mockResolvedValue(
      quarters.map(q => ({ ...q, priceEarningsRatio: 22, interestCoverage: 10 })),
    );
    (fmp.getKeyMetricsQuarterly as any).mockResolvedValue(
      quarters.map(q => ({ ...q, priceToFreeCashFlowsRatio: 25, netDebtToEBITDA: 1.5, roic: 0.15 })),
    );
    (fmp.getCashFlowStatementQuarterly as any).mockResolvedValue(
      quarters.map(q => ({ ...q, freeCashFlow: 10, dividendsPaid: -4 })),
    );
    (fmp.getIncomeStatementQuarterly as any).mockResolvedValue(
      quarters.map(q => ({ ...q, revenue: 100, grossProfit: 60, operatingIncome: 30, netIncome: 20 })),
    );
    (fmp.getDividends as any).mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({
        date: quarterDate(i),
        dividend: 0.5 * Math.pow(1.07, (40 - i) / 4),
      })),
    );

    const upsertQuarterly = vi.fn().mockResolvedValue({ error: null });
    const upsertMonthly = vi.fn().mockResolvedValue({ error: null });
    (sb.inspectAdminClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'ticker_inspect_quarterly') return { upsert: upsertQuarterly };
        if (table === 'ticker_inspect_monthly') return { upsert: upsertMonthly };
        if (table === 'ticker_price_history') {
          // 120 monthly closes (10 years), one per month
          const closes = Array.from({ length: 120 }, (_, i) => ({
            trade_date: `${2024 - Math.floor(i / 12)}-${String(12 - (i % 12)).padStart(2, '0')}-15`,
            close: 100 + i * 0.5,
          }));
          return makeChainedSelect(closes);
        }
        throw new Error(`unexpected table ${table}`);
      },
    });

    const res = await loadInspectBundle('MSFT');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error();

    expect(res.bundle.quarterly.length).toBeGreaterThanOrEqual(30);
    expect(res.bundle.monthly.length).toBeGreaterThanOrEqual(80);
    expect(res.bundle.quarterly[0].pe).toBe(22);
    expect(res.bundle.quarterly[0].gross_margin).toBeCloseTo(0.6, 3);
    expect(upsertQuarterly).toHaveBeenCalled();
    expect(upsertMonthly).toHaveBeenCalled();
  });
});

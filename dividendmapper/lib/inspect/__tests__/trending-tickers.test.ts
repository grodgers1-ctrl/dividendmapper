import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase-admin', () => ({ inspectAdminClient: vi.fn() }));

import { inspectAdminClient } from '../supabase-admin';
import { getTrendingTickers } from '../trending-tickers';

let rows: Array<{ ticker: string }> = [];
let queryError: unknown = null;

beforeEach(() => {
  rows = [];
  queryError = null;
  (inspectAdminClient as any).mockReturnValue({
    from: () => ({
      select: () => ({
        gte: () => Promise.resolve({ data: queryError ? null : rows, error: queryError }),
      }),
    }),
  });
});

describe('getTrendingTickers', () => {
  it('returns fallback when audit is empty', async () => {
    rows = [];
    const out = await getTrendingTickers(6);
    expect(out).toEqual(['MSFT', 'AAPL', 'JNJ', 'KO', 'BATS.L', 'NWG.L']);
  });

  it('returns fallback when audit has < 20 rows', async () => {
    rows = Array.from({ length: 19 }, (_, i) => ({ ticker: i % 2 === 0 ? 'AAPL' : 'MSFT' }));
    const out = await getTrendingTickers(6);
    expect(out).toEqual(['MSFT', 'AAPL', 'JNJ', 'KO', 'BATS.L', 'NWG.L']);
  });

  it('returns fallback on query error', async () => {
    queryError = { message: 'boom' };
    const out = await getTrendingTickers(6);
    expect(out).toEqual(['MSFT', 'AAPL', 'JNJ', 'KO', 'BATS.L', 'NWG.L']);
  });

  it('returns top-N by count when audit has ≥20 rows', async () => {
    rows = [
      ...Array(10).fill({ ticker: 'NVDA' }),
      ...Array(5).fill({ ticker: 'TSLA' }),
      ...Array(3).fill({ ticker: 'GOOG' }),
      ...Array(2).fill({ ticker: 'META' }),
    ];
    const out = await getTrendingTickers(3);
    expect(out).toEqual(['NVDA', 'TSLA', 'GOOG']);
  });

  it('honours the limit argument', async () => {
    rows = [
      ...Array(8).fill({ ticker: 'A' }),
      ...Array(6).fill({ ticker: 'B' }),
      ...Array(4).fill({ ticker: 'C' }),
      ...Array(2).fill({ ticker: 'D' }),
    ];
    const out = await getTrendingTickers(2);
    expect(out).toEqual(['A', 'B']);
  });
});

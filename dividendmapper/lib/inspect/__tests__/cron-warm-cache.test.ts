import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase-admin', () => ({ inspectAdminClient: vi.fn() }));
vi.mock('../load-inspect-bundle', () => ({ loadInspectBundle: vi.fn() }));
vi.mock('../read-cached-bundle', () => ({ readCachedBundle: vi.fn() }));

import { inspectAdminClient } from '../supabase-admin';
import { loadInspectBundle } from '../load-inspect-bundle';
import { readCachedBundle } from '../read-cached-bundle';
import { computeActiveSet, warmInspectCache } from '../cron-warm-cache';

let holdingsRows: Array<{ ticker: string }> = [];
let auditRows: Array<{ ticker: string }> = [];

function mkSb() {
  return {
    from: (table: string) => ({
      select: () => {
        if (table === 'holdings') return Promise.resolve({ data: holdingsRows, error: null });
        if (table === 'inspect_lookup_audit') {
          return { gte: () => Promise.resolve({ data: auditRows, error: null }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  holdingsRows = [];
  auditRows = [];
  (inspectAdminClient as any).mockImplementation(() => mkSb());
  (readCachedBundle as any).mockResolvedValue(null);
  (loadInspectBundle as any).mockResolvedValue({ status: 'ok', bundle: {}, cacheHit: false });
});

describe('computeActiveSet', () => {
  it('returns empty array when both sources are empty', async () => {
    const out = await computeActiveSet();
    expect(out).toEqual([]);
  });

  it('unions tickers from holdings and recent audit, deduped', async () => {
    holdingsRows = [{ ticker: 'MSFT' }, { ticker: 'AAPL' }, { ticker: 'MSFT' }];
    auditRows = [{ ticker: 'JNJ' }, { ticker: 'MSFT' }];
    const out = await computeActiveSet();
    expect([...out].sort()).toEqual(['AAPL', 'JNJ', 'MSFT']);
  });
});

describe('warmInspectCache', () => {
  it('skips tickers with fresh cache and loads stale ones', async () => {
    holdingsRows = [{ ticker: 'MSFT' }, { ticker: 'AAPL' }];
    (readCachedBundle as any).mockImplementation(async (t: string) => (t === 'MSFT' ? { ticker: 'MSFT' } : null));
    const summary = await warmInspectCache();
    expect(summary.attempted).toBe(2);
    expect(summary.warmed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect((loadInspectBundle as any).mock.calls.map((c: any[]) => c[0])).toEqual(['AAPL']);
  });

  it('counts uncoverable tickers separately', async () => {
    holdingsRows = [{ ticker: 'ZZZ.FAKE' }];
    (loadInspectBundle as any).mockResolvedValue({ status: 'uncoverable' });
    const summary = await warmInspectCache();
    expect(summary.attempted).toBe(1);
    expect(summary.uncoverable).toBe(1);
    expect(summary.warmed).toBe(0);
  });

  it('continues past per-ticker errors and reports failures', async () => {
    holdingsRows = [{ ticker: 'A' }, { ticker: 'B' }];
    (loadInspectBundle as any)
      .mockResolvedValueOnce({ status: 'ok', bundle: {} })
      .mockRejectedValueOnce(new Error('boom'));
    const summary = await warmInspectCache();
    expect(summary.attempted).toBe(2);
    expect(summary.warmed).toBe(1);
    expect(summary.failed).toBe(1);
  });
});

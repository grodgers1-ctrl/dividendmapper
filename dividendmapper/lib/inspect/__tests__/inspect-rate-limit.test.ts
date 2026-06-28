import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase-admin', () => ({ inspectAdminClient: vi.fn() }));

import { inspectAdminClient } from '../supabase-admin';
import { checkInspectRateLimit, recordInspectLookup } from '../inspect-rate-limit';

let countRows = 0;
let insertCalls: any[] = [];

beforeEach(() => {
  countRows = 0;
  insertCalls = [];
  (inspectAdminClient as any).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: countRows, data: null, error: null }),
        }),
      }),
      insert: (row: any) => {
        insertCalls.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  });
});

describe('checkInspectRateLimit', () => {
  it('allows anon under 3 lookups in 24h', async () => {
    countRows = 2;
    const res = await checkInspectRateLimit({ tier: 'anon', ipHash: 'abc', userId: null });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1);
  });
  it('blocks anon at 3 lookups', async () => {
    countRows = 3;
    const res = await checkInspectRateLimit({ tier: 'anon', ipHash: 'abc', userId: null });
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });
  it('allows free user up to 10 lookups in 24h', async () => {
    countRows = 9;
    const res = await checkInspectRateLimit({ tier: 'free', ipHash: 'abc', userId: 'u' });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1);
  });
  it('blocks free user at 10 lookups', async () => {
    countRows = 10;
    const res = await checkInspectRateLimit({ tier: 'free', ipHash: 'abc', userId: 'u' });
    expect(res.allowed).toBe(false);
  });
  it('always allows Pro and does not hit the DB', async () => {
    countRows = 9999;
    const res = await checkInspectRateLimit({ tier: 'pro', ipHash: 'abc', userId: 'u' });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(Infinity);
  });
  it('exposes a resetAt 24h in the future', async () => {
    countRows = 0;
    const before = Date.now();
    const res = await checkInspectRateLimit({ tier: 'anon', ipHash: 'abc', userId: null });
    const after = Date.now();
    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;
    expect(res.resetAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(res.resetAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});

describe('recordInspectLookup', () => {
  it('inserts an audit row', async () => {
    await recordInspectLookup({ ipHash: 'h', userId: 'u', ticker: 'MSFT', cacheHit: true });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      ip_hash: 'h',
      user_id: 'u',
      ticker: 'MSFT',
      cache_hit: true,
    });
  });
});

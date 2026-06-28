import { inspectAdminClient } from './supabase-admin';

export type Tier = 'anon' | 'free' | 'pro';

const LIMITS: Record<Tier, number> = { anon: 3, free: 10, pro: Infinity };
const WINDOW_MS = 24 * 60 * 60 * 1000;

export type RateLimitInput = { tier: Tier; ipHash: string; userId: string | null };
export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

export async function checkInspectRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const limit = LIMITS[input.tier];
  const resetAt = new Date(Date.now() + WINDOW_MS);
  if (limit === Infinity) return { allowed: true, remaining: Infinity, resetAt };

  const sb = inspectAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const baseQuery = sb.from('inspect_lookup_audit').select('*', { count: 'exact', head: true });
  const filtered = input.tier === 'anon'
    ? baseQuery.eq('ip_hash', input.ipHash).gte('occurred_at', since)
    : baseQuery.eq('user_id', input.userId!).gte('occurred_at', since);

  const { count, error } = await filtered;
  if (error) throw error;
  const used = count ?? 0;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), resetAt };
}

export async function recordInspectLookup(opts: {
  ipHash: string;
  userId: string | null;
  ticker: string;
  cacheHit: boolean;
}): Promise<void> {
  const sb = inspectAdminClient();
  const { error } = await sb.from('inspect_lookup_audit').insert({
    ip_hash: opts.ipHash,
    user_id: opts.userId,
    ticker: opts.ticker,
    cache_hit: opts.cacheHit,
  });
  if (error) throw error;
}

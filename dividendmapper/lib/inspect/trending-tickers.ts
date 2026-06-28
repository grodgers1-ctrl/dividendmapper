import { inspectAdminClient } from './supabase-admin';

const FALLBACK = ['MSFT', 'AAPL', 'JNJ', 'KO', 'BATS.L', 'NWG.L'];
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_ROWS_FOR_TRENDING = 20;

export async function getTrendingTickers(limit = 6): Promise<string[]> {
  const sb = inspectAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await sb
    .from('inspect_lookup_audit')
    .select('ticker')
    .gte('occurred_at', since);

  if (error || !data || data.length < MIN_ROWS_FOR_TRENDING) {
    return FALLBACK.slice(0, limit);
  }

  const counts = new Map<string, number>();
  for (const row of data as Array<{ ticker: string }>) {
    counts.set(row.ticker, (counts.get(row.ticker) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

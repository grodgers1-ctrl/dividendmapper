import { inspectAdminClient } from './supabase-admin';
import { loadInspectBundle } from './load-inspect-bundle';
import { readCachedBundle } from './read-cached-bundle';

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CONCURRENCY = 4;

export async function computeActiveSet(): Promise<string[]> {
  const sb = inspectAdminClient();
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

  const [holdingsRes, auditRes] = await Promise.all([
    sb.from('holdings').select('ticker'),
    sb.from('inspect_lookup_audit').select('ticker').gte('occurred_at', since),
  ]);

  const set = new Set<string>();
  for (const row of (holdingsRes.data as Array<{ ticker: string }> | null) ?? []) set.add(row.ticker);
  for (const row of (auditRes.data as Array<{ ticker: string }> | null) ?? []) set.add(row.ticker);
  return [...set];
}

export type WarmSummary = {
  attempted: number;
  warmed: number;
  skipped: number;
  uncoverable: number;
  failed: number;
};

async function runWithConcurrency<T>(items: T[], cap: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(cap, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export async function warmInspectCache(): Promise<WarmSummary> {
  const tickers = await computeActiveSet();
  const summary: WarmSummary = { attempted: 0, warmed: 0, skipped: 0, uncoverable: 0, failed: 0 };

  await runWithConcurrency(tickers, CONCURRENCY, async (ticker) => {
    summary.attempted++;
    try {
      const cached = await readCachedBundle(ticker);
      if (cached) {
        summary.skipped++;
        return;
      }
      const result = await loadInspectBundle(ticker);
      if (result.status === 'uncoverable') summary.uncoverable++;
      else summary.warmed++;
    } catch {
      summary.failed++;
    }
  });

  return summary;
}

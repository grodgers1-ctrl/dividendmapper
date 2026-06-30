import { inspectAdminClient } from "@/lib/inspect/supabase-admin";
import type { ScreenerRow } from "@/app/app/etfs/_components/etf-screener";

export type EtfSpotlightBasis = "trending" | "quality" | "hybrid";

export interface EtfSpotlightResult {
  picks: ScreenerRow[];
  basis: EtfSpotlightBasis;
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PICK_COUNT = 5;
const MIN_VIEWS_FOR_TRENDING = 3;

/**
 * Reuses the audit-table pattern in `getTrendingTickers()` (24h, no join). Here
 * we look at a 7-day window and intersect against `rows` in JS — no FK to
 * `tickers` assumed. Returns 5 picks plus a `basis` flag so the heading copy
 * tracks the data source.
 *
 * Cases:
 *   A — trending only: every top-5 by views has >= 3 views → basis 'trending'
 *   B — pure fallback: zero ETF rows in audit → basis 'quality'
 *   C — hybrid pad: some have >= 3 views, others don't → basis 'hybrid'
 */
export async function loadEtfSpotlight(
  rows: ScreenerRow[],
): Promise<EtfSpotlightResult> {
  const universe = new Set(rows.map((r) => r.ticker));
  const rowByTicker = new Map(rows.map((r) => [r.ticker, r] as const));

  // Quality fallback list — highest quality first, nulls last.
  const byQuality = [...rows].sort((a, b) => {
    const av = a.quality_headline;
    const bv = b.quality_headline;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });

  let counts: Map<string, number> = new Map();
  try {
    const sb = inspectAdminClient();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data, error } = await sb
      .from("inspect_lookup_audit")
      .select("ticker")
      .gte("occurred_at", since);

    if (!error && data) {
      for (const row of data as Array<{ ticker: string }>) {
        if (!universe.has(row.ticker)) continue;
        counts.set(row.ticker, (counts.get(row.ticker) ?? 0) + 1);
      }
    }
  } catch {
    // Service-role env missing in some environments — fall back to quality.
    counts = new Map();
  }

  // No ETF views in window → Case B.
  if (counts.size === 0) {
    return {
      picks: byQuality.slice(0, PICK_COUNT),
      basis: "quality",
    };
  }

  const byViews = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, v]) => ({ ticker: t, views: v }))
    .filter((e) => rowByTicker.has(e.ticker));

  const topByViews = byViews.slice(0, PICK_COUNT);

  // Case A — every top-5 has >= MIN_VIEWS_FOR_TRENDING views (and we have a
  // full top-5).
  if (
    topByViews.length === PICK_COUNT &&
    topByViews.every((e) => e.views >= MIN_VIEWS_FOR_TRENDING)
  ) {
    const picks = topByViews
      .map((e) => rowByTicker.get(e.ticker))
      .filter((r): r is ScreenerRow => r != null);
    return { picks, basis: "trending" };
  }

  // Case C — hybrid: take the ones that meet the threshold, pad the rest from
  // quality (skipping anything already picked). If nothing met the threshold,
  // we get back a pure-quality list; label it 'quality' in that case.
  const trendingHits = topByViews.filter(
    (e) => e.views >= MIN_VIEWS_FOR_TRENDING,
  );

  const picks: ScreenerRow[] = trendingHits
    .map((e) => rowByTicker.get(e.ticker))
    .filter((r): r is ScreenerRow => r != null);

  const taken = new Set(picks.map((r) => r.ticker));
  for (const r of byQuality) {
    if (picks.length >= PICK_COUNT) break;
    if (taken.has(r.ticker)) continue;
    picks.push(r);
    taken.add(r.ticker);
  }

  return {
    picks: picks.slice(0, PICK_COUNT),
    basis: trendingHits.length > 0 ? "hybrid" : "quality",
  };
}

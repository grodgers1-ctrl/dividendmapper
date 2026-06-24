import type { SupabaseClient } from "@supabase/supabase-js";

// Helper for the BDC list page. equity_scores doesn't carry a yield column;
// the most recent current_yield per ticker lives in equity_score_history (same
// pattern lib/scoring/load-portfolio-analytics.ts uses for the dashboard).

export async function fetchLatestYieldsForTickers(
  client: SupabaseClient,
  tickers: string[],
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (tickers.length === 0) return map;
  const { data } = await client
    .from("equity_score_history")
    .select("ticker, current_yield, observed_at")
    .in("ticker", tickers)
    .order("observed_at", { ascending: false })
    .returns<{ ticker: string; current_yield: number | null; observed_at: string }[]>();
  for (const row of data ?? []) {
    if (map.has(row.ticker)) continue;
    map.set(row.ticker, row.current_yield != null ? Number(row.current_yield) : null);
  }
  return map;
}

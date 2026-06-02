import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * The tickers that currently have a row in equity_scores, alphabetical. Shared
 * by the /scoring index and the scoring not-found page. Cookieless public read;
 * best-effort (returns [] on failure so a render never breaks).
 */
export async function listScoredTickers(): Promise<string[]> {
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("equity_scores")
      .select("ticker")
      .order("ticker", { ascending: true });
    return (data ?? []).map((r) => (r as { ticker: string }).ticker);
  } catch {
    return [];
  }
}

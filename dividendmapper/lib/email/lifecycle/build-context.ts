import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkipContext } from "./skip-gates";

// Per-user context bundle the cron passes to skip-gates and templates.
// The shape extends SkipContext so the gate functions can consume it
// directly without a translation step.

export interface LifecycleUserInput {
  userId: string;
  tier: "free" | "pro" | "premium";
  lifecycleUnsubscribed: boolean;
  lastSignInAt: string | null;
  nowMs: number;
}

export interface LifecycleContext extends SkipContext {
  userId: string;
  lowestScoringTicker: { ticker: string; score: number } | null;
}

export async function buildLifecycleContext(
  supabase: SupabaseClient,
  input: LifecycleUserInput,
): Promise<LifecycleContext> {
  const { data: holdingRows } = await supabase
    .from("holdings")
    .select("ticker")
    .eq("user_id", input.userId);
  const tickers = ((holdingRows ?? []) as { ticker: string }[]).map((r) => r.ticker);
  const uniqueTickers = Array.from(new Set(tickers));

  let lowestScoringTicker: { ticker: string; score: number } | null = null;
  if (uniqueTickers.length > 0) {
    const { data: scoreRows } = await supabase
      .from("equity_score_history")
      .select("ticker, buy_score")
      .in("ticker", uniqueTickers)
      .order("buy_score", { ascending: true })
      .limit(1);
    const row = ((scoreRows ?? []) as { ticker: string; buy_score: number | null }[])[0];
    if (row && row.buy_score !== null) {
      lowestScoringTicker = { ticker: row.ticker, score: row.buy_score };
    }
  }

  const lastSignInAtMs = input.lastSignInAt ? Date.parse(input.lastSignInAt) : null;

  return {
    userId: input.userId,
    holdingsCount: tickers.length,
    tier: input.tier,
    lifecycleUnsubscribed: input.lifecycleUnsubscribed,
    lastSignInAtMs:
      lastSignInAtMs !== null && Number.isNaN(lastSignInAtMs) ? null : lastSignInAtMs,
    nowMs: input.nowMs,
    lowestScoringTicker,
  };
}

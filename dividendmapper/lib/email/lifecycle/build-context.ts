import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkipContext } from "./skip-gates";

// Per-user context bundle the cron passes to skip-gates and templates.
// Extends SkipContext so evalSkipGate can consume it directly. Loads
// everything templates 3-6 need in one place so the dispatcher stays
// purely a switch over the data.

const DAY_MS = 24 * 60 * 60 * 1000;
const SCORE_MOVE_THRESHOLD = 5;
const HISTORY_WINDOW_DAYS = 35;
const EX_DIV_LOOKAHEAD_DAYS = 30;

export type ProPitchAction = "BUY" | "HOLD" | "TRIM";

export interface LifecycleUserInput {
  userId: string;
  tier: "free" | "pro" | "premium";
  lifecycleUnsubscribed: boolean;
  lastSignInAt: string | null;
  nowMs: number;
}

export interface ProPitchLine {
  ticker: string;
  action: ProPitchAction;
  score: number;
}

export interface ScoreMove {
  ticker: string;
  from: number;
  to: number;
}

export interface UpcomingExDiv {
  ticker: string;
  exDate: string;
  payment: string;
}

export interface LifecycleContext extends SkipContext {
  userId: string;
  lowestScoringTicker: { ticker: string; score: number } | null;
  proPitchLines: ProPitchLine[];
  recentScoreMoves: ScoreMove[];
  upcomingExDivs: UpcomingExDiv[];
}

function actionFromScore(score: number): ProPitchAction {
  if (score >= 70) return "BUY";
  if (score <= 30) return "TRIM";
  return "HOLD";
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
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
  let proPitchLines: ProPitchLine[] = [];
  const recentScoreMoves: ScoreMove[] = [];
  const upcomingExDivs: UpcomingExDiv[] = [];

  if (uniqueTickers.length > 0) {
    // Latest score per held ticker (drives proPitchLines + lowestScoringTicker).
    const { data: latestRows } = await supabase
      .from("equity_score_history")
      .select("ticker, buy_score, observed_at")
      .in("ticker", uniqueTickers)
      .order("observed_at", { ascending: false });
    const latestByTicker = new Map<string, number>();
    for (const row of (latestRows ?? []) as {
      ticker: string;
      buy_score: number | null;
      observed_at: string;
    }[]) {
      if (latestByTicker.has(row.ticker)) continue;
      if (row.buy_score === null) continue;
      latestByTicker.set(row.ticker, row.buy_score);
    }
    proPitchLines = Array.from(latestByTicker.entries()).map(([ticker, score]) => ({
      ticker,
      action: actionFromScore(score),
      score,
    }));
    for (const line of proPitchLines) {
      if (!lowestScoringTicker || line.score < lowestScoringTicker.score) {
        lowestScoringTicker = { ticker: line.ticker, score: line.score };
      }
    }

    // 35-day history window for recentScoreMoves. Group in memory; oldest
    // vs newest per ticker; keep only deltas >= SCORE_MOVE_THRESHOLD.
    const sinceIso = isoDate(input.nowMs - HISTORY_WINDOW_DAYS * DAY_MS);
    const { data: histRows } = await supabase
      .from("equity_score_history")
      .select("ticker, buy_score, observed_at")
      .in("ticker", uniqueTickers)
      .gte("observed_at", sinceIso)
      .order("observed_at", { ascending: true });
    const histByTicker = new Map<string, { score: number; observedAt: string }[]>();
    for (const row of (histRows ?? []) as {
      ticker: string;
      buy_score: number | null;
      observed_at: string;
    }[]) {
      if (row.buy_score === null) continue;
      const list = histByTicker.get(row.ticker) ?? [];
      list.push({ score: row.buy_score, observedAt: row.observed_at });
      histByTicker.set(row.ticker, list);
    }
    for (const [ticker, list] of histByTicker) {
      if (list.length < 2) continue;
      const from = list[0].score;
      const to = list[list.length - 1].score;
      if (Math.abs(to - from) >= SCORE_MOVE_THRESHOLD) {
        recentScoreMoves.push({ ticker, from, to });
      }
    }

    // Upcoming ex-divs (next 30 days) for the recap.
    const todayIso = isoDate(input.nowMs);
    const ahead = isoDate(input.nowMs + EX_DIV_LOOKAHEAD_DAYS * DAY_MS);
    const { data: exDivRows } = await supabase
      .from("equity_scores")
      .select("ticker, next_ex_div_date, next_ex_div_amount")
      .in("ticker", uniqueTickers)
      .gt("next_ex_div_date", todayIso)
      .lt("next_ex_div_date", ahead);
    for (const row of (exDivRows ?? []) as {
      ticker: string;
      next_ex_div_date: string | null;
      next_ex_div_amount: number | null;
    }[]) {
      if (row.next_ex_div_date && row.next_ex_div_amount !== null) {
        upcomingExDivs.push({
          ticker: row.ticker,
          exDate: row.next_ex_div_date,
          payment: row.next_ex_div_amount.toString(),
        });
      }
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
    proPitchLines,
    recentScoreMoves,
    upcomingExDivs,
  };
}

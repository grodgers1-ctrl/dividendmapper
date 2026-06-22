// Daily cron: snapshot every active user's forward-annual dividend income,
// bucketed by source currency, into portfolio_income_history. Feeds the
// dashboard RidgeSparkline so the 12-month trend reads as real history
// instead of a synthetic ramp.
//
// Runs once a day AFTER the nightly scoring refresh so the dividend-per-share
// values we read from equity_score_history are fresh.
//
// Auth: Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends it). Per-user
// failures are caught + Sentry-captured but never abort the run.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  aggregatePortfolioIncome,
  actualKey,
  type ActualIncome,
} from "@/lib/portfolio/income";
import { scoringDividendQuote } from "@/lib/portfolio/uk-income";
import type { QuoteResult } from "@/lib/market/quote";
import { isoDateOffset } from "@/lib/scoring/score-ticker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TTM_DAYS = 365;

type HoldingRow = {
  user_id: string;
  ticker: string;
  quantity: number;
  wrapper: string;
};

type DividendRow = {
  user_id: string;
  ticker_scoring: string | null;
  wrapper: string;
  amount: number;
  currency: string;
};

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[snapshot-portfolio-income] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[snapshot-portfolio-income] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const today = isoDateOffset(0);
  const sinceDate = isoDateOffset(-TTM_DAYS);

  // One sweep of every active holding — group client-side.
  const { data: holdingRows, error: holdingsErr } = await supabase
    .from("holdings")
    .select("user_id, ticker, quantity, wrapper")
    .is("archived_at", null)
    .returns<HoldingRow[]>();
  if (holdingsErr) {
    Sentry.captureException(holdingsErr);
    return NextResponse.json({ error: "holdings_query_failed" }, { status: 500 });
  }
  const holdings = holdingRows ?? [];

  if (holdings.length === 0) {
    return NextResponse.json({
      ok: true,
      userCount: 0,
      rowsUpserted: 0,
      skippedEmpty: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  // Latest dividend-per-share per ticker — single query.
  const allTickers = [...new Set(holdings.map((h) => h.ticker))];
  const { data: divHistRows } = await supabase
    .from("equity_score_history")
    .select("ticker, dividend_per_share, observed_at")
    .in("ticker", allTickers)
    .order("observed_at", { ascending: false })
    .returns<{ ticker: string; dividend_per_share: number | null; observed_at: string }[]>();
  const dpsByTicker = new Map<string, number>();
  for (const r of divHistRows ?? []) {
    if (!dpsByTicker.has(r.ticker) && r.dividend_per_share != null) {
      dpsByTicker.set(r.ticker, Number(r.dividend_per_share));
    }
  }

  // TTM actuals across all users — single query, group client-side.
  const { data: actualsRows } = await supabase
    .from("user_dividends")
    .select("user_id, ticker_scoring, wrapper, amount, currency")
    .gte("paid_on", sinceDate)
    .returns<DividendRow[]>();
  const actualsByUser = new Map<string, Map<string, ActualIncome>>();
  for (const d of actualsRows ?? []) {
    if (!d.ticker_scoring) continue;
    const userMap =
      actualsByUser.get(d.user_id) ??
      (actualsByUser.set(d.user_id, new Map()).get(d.user_id) as Map<string, ActualIncome>);
    const key = actualKey(d.ticker_scoring, d.wrapper);
    const existing = userMap.get(key);
    if (existing) existing.amount += Number(d.amount);
    else userMap.set(key, { amount: Number(d.amount), currency: d.currency });
  }

  // Per-user: build a synthetic quotes map (no live FMP call — uses persisted
  // dps), run the same aggregator the dashboard does, upsert per-currency rows.
  const userIds = [...new Set(holdings.map((h) => h.user_id))];
  let rowsUpserted = 0;
  let skippedEmpty = 0;
  let failedUsers = 0;
  for (const userId of userIds) {
    try {
      const userHoldings = holdings.filter((h) => h.user_id === userId);
      const quotes = new Map<string, QuoteResult>();
      for (const t of new Set(userHoldings.map((h) => h.ticker))) {
        const dps = dpsByTicker.get(t) ?? null;
        const q = scoringDividendQuote(t, dps);
        if (q) quotes.set(t, q);
      }
      const actuals = actualsByUser.get(userId) ?? new Map<string, ActualIncome>();
      const income = aggregatePortfolioIncome(userHoldings, quotes, actuals);
      if (income.totalsByCurrency.length === 0) {
        skippedEmpty += 1;
        continue;
      }
      const upsertRows = income.totalsByCurrency.map((t) => ({
        user_id: userId,
        snapshot_at: today,
        currency: t.currency,
        total_annual_run_rate: t.total,
      }));
      const { error } = await supabase
        .from("portfolio_income_history")
        .upsert(upsertRows, { onConflict: "user_id,snapshot_at,currency" });
      if (error) {
        failedUsers += 1;
        Sentry.captureException(error, { extra: { userId } });
        continue;
      }
      rowsUpserted += upsertRows.length;
    } catch (err) {
      failedUsers += 1;
      Sentry.captureException(err, { extra: { userId } });
    }
  }

  return NextResponse.json({
    ok: true,
    userCount: userIds.length,
    rowsUpserted,
    skippedEmpty,
    failedUsers,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

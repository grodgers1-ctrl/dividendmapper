// Nightly cron for Phase 2.75 scoring. For each unique holdings ticker it pulls
// the full FMP data bundle, assembles the Buy/Trim/Risk inputs, runs the three
// score composers, and persists:
//   • equity_scores            — latest score per ticker (public-read)
//   • equity_score_history     — daily snapshot + the inputs R1/R4/R5/R6 read back
//   • equity_score_signals     — top-5 signal contributions per score type (drawer)
//
// Auth: Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends it). Per-ticker
// failures are caught + Sentry-captured but never abort the run.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { getDividendsCalendar, type FmpCalendarDividend } from "@/lib/scoring/fmp-client";
import { scoreTicker, isoDateOffset } from "@/lib/scoring/score-ticker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// We pad FMP_TICKER_PAD_MS between tickers to stay well clear of FMP's
// burst/concurrency guard. Env-tunable without code changes; pad is 0 under test.
const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.FMP_TICKER_PAD_MS) || 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-equity-scores] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refresh-equity-scores] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const today = isoDateOffset(0);

  // Score the union of held tickers and watchlisted (tracked) tickers, so Pro
  // users get live scores on tickers they follow but don't own yet.
  const [holdingsRes, trackedRes] = (await Promise.all([
    supabase.from("holdings").select("ticker"),
    supabase.from("tracked_tickers").select("ticker"),
  ])) as { data: { ticker: string }[] | null; error: unknown }[];
  if (holdingsRes.error || trackedRes.error) {
    Sentry.captureException(holdingsRes.error ?? trackedRes.error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const uniqueTickers = Array.from(
    new Set([...(holdingsRes.data ?? []), ...(trackedRes.data ?? [])].map((r) => r.ticker)),
  ).sort();

  // One market-wide dividends-calendar pull serves every ticker's D2 lookup.
  let calendar: FmpCalendarDividend[] = [];
  try {
    calendar = await getDividendsCalendar(today, isoDateOffset(90));
  } catch (err) {
    Sentry.captureException(err, { extra: { stage: "dividends-calendar" } });
  }

  let successfulTickerCount = 0;
  let failedTickerCount = 0;

  for (let t = 0; t < uniqueTickers.length; t++) {
    const ticker = uniqueTickers[t];
    if (t > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      await scoreTicker(supabase, ticker, calendar, today);
      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-equity-scores] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  return NextResponse.json({
    ok: true,
    tickerCount: uniqueTickers.length,
    successfulTickerCount,
    failedTickerCount,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

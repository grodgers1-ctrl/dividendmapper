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
import {
  getDividendsCalendar,
  getHistoricalEod,
  type FmpCalendarDividend,
} from "@/lib/scoring/fmp-client";
import { scoreTicker, isoDateOffset } from "@/lib/scoring/score-ticker";
import { warmInspectCache, type WarmSummary } from "@/lib/inspect/cron-warm-cache";
import { inspectAdminClient } from "@/lib/inspect/supabase-admin";

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
      // Append today's close to ticker_price_history for the row sparkline on
      // /app/portfolio. scoreTicker has already pulled FMP for this ticker, so
      // this getHistoricalEod hits the fmp-client 24h in-memory cache for any
      // matching from/to — and even on a miss it's a single small request.
      try {
        const fromIso = isoDateOffset(-4);
        const bars = await getHistoricalEod(ticker, fromIso, today);
        const latest = bars?.[0];
        if (
          latest &&
          typeof latest.close === "number" &&
          Number.isFinite(latest.close) &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(latest.date))
        ) {
          const currency = ticker.endsWith(".L") ? "GBp" : "USD";
          const { error: tphErr } = await supabase
            .from("ticker_price_history")
            .upsert(
              {
                ticker,
                trade_date: latest.date,
                close: latest.close,
                currency,
              },
              { onConflict: "ticker,trade_date" },
            );
          if (tphErr) {
            console.warn(
              `[refresh-equity-scores] ticker_price_history upsert failed for ${ticker}: ${tphErr.message}`,
            );
          }
        }
      } catch (priceErr) {
        Sentry.captureException(priceErr, { extra: { ticker, stage: "ticker_price_history" } });
      }
      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-equity-scores] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  // Warm the inspect-cache for the active ticker set. Wrapped so any failure
  // here can never roll back the equity-scoring work above.
  let inspectWarm: WarmSummary | string;
  try {
    inspectWarm = await warmInspectCache();
  } catch (err) {
    Sentry.captureException(err, { extra: { stage: "warm-inspect-cache" } });
    inspectWarm = `failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Prune the inspect lookup audit (7-day retention). Same try/catch story.
  let inspectAuditPruned: number | string = 0;
  try {
    const sb = inspectAdminClient();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await sb
      .from("inspect_lookup_audit")
      .delete({ count: "exact" })
      .lt("occurred_at", cutoff);
    if (error) throw error;
    inspectAuditPruned = count ?? 0;
  } catch (err) {
    Sentry.captureException(err, { extra: { stage: "prune-inspect-audit" } });
    inspectAuditPruned = `failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    ok: true,
    tickerCount: uniqueTickers.length,
    successfulTickerCount,
    failedTickerCount,
    durationMs: Date.now() - startedAt,
    inspect_warm: inspectWarm,
    inspect_audit_pruned: inspectAuditPruned,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

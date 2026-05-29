// Nightly cron skeleton for Phase 2.75. Day 1 contract: prove the cron infra
// works end-to-end. For each unique ticker in holdings, call FMP getProfile
// (validates the API client works in prod), then write an empty history row
// for today's date. Days 2-5 expand this to compute real scores.
//
// Auth: validates Authorization: Bearer ${CRON_SECRET}. Vercel Cron sends
// this header automatically when invoking scheduled functions.
//
// Failure model: per-ticker errors are caught + Sentry-captured but don't
// abort the job. Returns aggregate counts in the response body for monitoring.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { getProfile } from "@/lib/scoring/fmp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps maxDuration at 300s. Plenty for current cohort; revisit
// when ticker count crosses ~1000 (each ticker is ~200-500ms of FMP + DB work).
export const maxDuration = 300;

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-equity-scores] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
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

  const { data: rows, error: tickersErr } = (await supabase
    .from("holdings")
    .select("ticker")) as { data: { ticker: string }[] | null; error: unknown };
  if (tickersErr) {
    console.error("[refresh-equity-scores] holdings query failed", tickersErr);
    Sentry.captureException(tickersErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const uniqueTickers = Array.from(
    new Set((rows ?? []).map((r) => r.ticker)),
  ).sort();

  const today = new Date().toISOString().slice(0, 10);
  let successfulTickerCount = 0;
  let failedTickerCount = 0;

  for (const ticker of uniqueTickers) {
    try {
      await getProfile(ticker);
      const { error: upsertErr } = await supabase
        .from("equity_score_history")
        .upsert(
          {
            ticker,
            observed_at: today,
            buy_score: null,
            trim_score: null,
            risk_score: null,
          },
          { onConflict: "ticker,observed_at" },
        );
      if (upsertErr) throw upsertErr;
      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-equity-scores] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  const durationMs = Date.now() - startedAt;
  return NextResponse.json({
    ok: true,
    tickerCount: uniqueTickers.length,
    successfulTickerCount,
    failedTickerCount,
    durationMs,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

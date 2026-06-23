// Phase 4 Sprint 2 Day 11 — Daily vehicle scoring cron.
// Runs at 09:00 UTC (one hour after the price cron at 08:00). Iterates the
// active V1 universe, calls computeVehicleScore() per ticker, then persists
// the result to vehicle_scores (upsert), vehicle_score_signals (append) and
// vehicle_score_history (daily snapshot). Per-ticker failures are
// Sentry-captured; the cron returns a structured summary either way.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { computeVehicleScore } from "@/lib/scoring/compute-vehicle-score";
import {
  upsertVehicleScore,
  appendVehicleScoreSignals,
  appendVehicleScoreHistory,
} from "@/lib/scoring/vehicle-persist";
import type { VehicleType } from "@/lib/scoring/vehicle-fmp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.SCORING_TICKER_PAD_MS) || 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-vehicle-scores] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refresh-vehicle-scores] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();

  const { data: universe, error: uErr } = await supabase
    .from("vehicle_universe")
    .select("ticker, vehicle_type")
    .eq("status", "active")
    .eq("included_in_v1", true);
  if (uErr) {
    Sentry.captureException(uErr, { extra: { stage: "vehicle_universe" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const rows = (universe ?? []) as { ticker: string; vehicle_type: VehicleType }[];

  let successfulTickerCount = 0;
  let failedTickerCount = 0;
  let scoredCount = 0;
  let gateFailedCount = 0;

  for (let t = 0; t < rows.length; t++) {
    const { ticker, vehicle_type } = rows[t];
    if (t > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      const result = await computeVehicleScore(supabase, ticker, vehicle_type);
      await upsertVehicleScore(supabase, result);
      await appendVehicleScoreSignals(supabase, result);
      await appendVehicleScoreHistory(supabase, result);
      if (result.resilienceScore !== null) scoredCount += 1;
      else gateFailedCount += 1;
      successfulTickerCount += 1;
    } catch (err) {
      failedTickerCount += 1;
      console.error(`[refresh-vehicle-scores] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  return NextResponse.json({
    ok: true,
    tickerCount: rows.length,
    successfulTickerCount,
    failedTickerCount,
    scoredCount,
    gateFailedCount,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

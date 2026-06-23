// Phase 4 Sprint 1 Day 3 — Daily price refresh cron for income vehicles.
// Mirrors refresh-equity-scores/route.ts: Bearer-token auth, service-role
// supabase, per-ticker fan-out with TICKER_PAD_MS pacing, Sentry on per-ticker
// failure. Pulls last 5 trading days each run (idempotent on the
// (ticker, observed_at) unique key) so weekend/holiday skips self-heal.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { fetchVehiclePrices, type Currency } from "@/lib/scoring/vehicle-fmp";
import { upsertVehiclePrices } from "@/lib/scoring/vehicle-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAYS_BACK = 5;
const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.FMP_TICKER_PAD_MS) || 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-vehicle-prices] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refresh-vehicle-prices] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();

  const { data: universe, error: uErr } = await supabase
    .from("vehicle_universe")
    .select("ticker, currency")
    .eq("status", "active")
    .eq("included_in_v1", true);
  if (uErr) {
    Sentry.captureException(uErr, { extra: { stage: "vehicle_universe" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const rows = (universe ?? []) as { ticker: string; currency: string }[];

  let successfulTickerCount = 0;
  let failedTickerCount = 0;
  let priceRowsUpserted = 0;

  for (let t = 0; t < rows.length; t++) {
    const { ticker, currency } = rows[t];
    if (t > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      const priceRows = await fetchVehiclePrices(ticker, DAYS_BACK, currency as Currency);
      await upsertVehiclePrices(supabase, priceRows);
      priceRowsUpserted += priceRows.length;
      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-vehicle-prices] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  return NextResponse.json({
    ok: true,
    tickerCount: rows.length,
    successfulTickerCount,
    failedTickerCount,
    priceRowsUpserted,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

// Phase 4 Sprint 1 Day 4 — Weekly fundamentals refresh cron for income vehicles.
// Sunday 02:00 UTC (per vercel.json). Iterates vehicle_universe, calls
// fetchVehicleFundamentals (which pulls income+balance+key-metrics from FMP
// per vehicleType), upserts to vehicle_fundamentals. Mirrors refresh-vehicle-
// prices route shape.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  fetchVehicleFundamentals,
  type Currency,
  type VehicleType,
} from "@/lib/scoring/vehicle-fmp";
import { upsertVehicleFundamentals } from "@/lib/scoring/vehicle-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 min — 100 tickers × 3 FMP calls + 1s pacing

const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.FMP_TICKER_PAD_MS) || 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-vehicle-fundamentals] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refresh-vehicle-fundamentals] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();

  const { data: universe, error: uErr } = await supabase
    .from("vehicle_universe")
    .select("ticker, vehicle_type, currency")
    .eq("status", "active")
    .eq("included_in_v1", true);
  if (uErr) {
    Sentry.captureException(uErr, { extra: { stage: "vehicle_universe" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const rows = (universe ?? []) as { ticker: string; vehicle_type: VehicleType; currency: Currency }[];

  let successfulTickerCount = 0;
  let failedTickerCount = 0;
  let fundamentalsRowsUpserted = 0;

  for (let t = 0; t < rows.length; t++) {
    const { ticker, vehicle_type, currency } = rows[t];
    if (t > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      const fundamentalsRows = await fetchVehicleFundamentals(ticker, vehicle_type, currency);
      await upsertVehicleFundamentals(supabase, fundamentalsRows);
      fundamentalsRowsUpserted += fundamentalsRows.length;
      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-vehicle-fundamentals] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  return NextResponse.json({
    ok: true,
    tickerCount: rows.length,
    successfulTickerCount,
    failedTickerCount,
    fundamentalsRowsUpserted,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

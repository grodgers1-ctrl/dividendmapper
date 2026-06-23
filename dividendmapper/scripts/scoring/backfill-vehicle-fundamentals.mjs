// Phase 4 Sprint 1 Day 5 — One-shot fundamentals backfill.
// Mirrors the refresh-vehicle-fundamentals cron logic. Invoked manually
// during Sprint 1 to populate vehicle_fundamentals before the Sunday cron
// has had a chance to run.
//
//   node dividendmapper/scripts/scoring/backfill-vehicle-fundamentals.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const PAD_MS = 1000;

// --- env ---
const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}
const apiKey = process.env.FMP_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !supabaseUrl || !serviceKey) {
  console.error("missing FMP_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function normaliseToGbp(value, currency) {
  if (value == null) return null;
  return currency === "GBX" ? round4(value / 100) : value;
}

function num(row, key) {
  const v = row?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fmp(endpoint, params) {
  const url = new URL(`${FMP_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${endpoint}: ${r.status}`);
  const body = await r.json();
  return Array.isArray(body) ? body : [];
}

async function fetchFundamentals(ticker, vehicleType, currency) {
  const fmpPeriod = vehicleType === "uk_reit" ? "annual" : "quarter";
  const periodType = vehicleType === "uk_reit" ? "semi_annual" : "quarterly";
  const limit = vehicleType === "uk_reit" ? 10 : 8;

  const [income, balance, keyMetrics] = await Promise.all([
    fmp("income-statement", { symbol: ticker, period: fmpPeriod, limit: String(limit) }),
    fmp("balance-sheet-statement", { symbol: ticker, period: fmpPeriod, limit: String(limit) }),
    fmp("key-metrics", { symbol: ticker, period: fmpPeriod, limit: String(limit) }),
  ]);
  const balByDate = new Map(balance.map((r) => [r.date, r]));
  const kmByDate = new Map(keyMetrics.map((r) => [r.date, r]));

  return income.map((inc) => {
    const bal = balByDate.get(inc.date);
    const km = kmByDate.get(inc.date);
    // FMP's /key-metrics doesn't expose bookValuePerShare (probe 2026-06-23).
    // Fall back to totalEquity ÷ weightedAverageShsOut. The computed branch
    // is already in absolute £ for UK REITs (don't divide by 100); only the
    // BVPS-from-key-metrics branch needs GBX→GBP normalisation.
    const bvpsRaw = km ? num(km, "bookValuePerShare") : null;
    let navPerShare;
    if (bvpsRaw != null) {
      navPerShare = normaliseToGbp(bvpsRaw, currency);
    } else {
      const eq = bal ? num(bal, "totalEquity") : null;
      const shs = num(inc, "weightedAverageShsOut");
      navPerShare = eq != null && shs != null && shs > 0 ? round4(eq / shs) : null;
    }
    return {
      ticker,
      period_end: inc.date,
      period_type: periodType,
      ffo_per_share: null,
      affo_per_share: null,
      nii_per_share: null,
      nav_per_share: navPerShare,
      debt_total: bal ? num(bal, "totalDebt") : null,
      equity_total: bal ? num(bal, "totalEquity") : null,
      ebitda: num(inc, "ebitda"),
      interest_expense: num(inc, "interestExpense"),
      ltv_pct: null,
    };
  });
}

const startedAt = Date.now();

const { data: universe, error: uErr } = await sb
  .from("vehicle_universe")
  .select("ticker, vehicle_type, currency")
  .eq("status", "active")
  .eq("included_in_v1", true);
if (uErr) {
  console.error("universe query failed:", uErr);
  process.exit(1);
}
console.log(`→ fundamentals backfill: ${universe.length} tickers`);

let okCount = 0;
let failCount = 0;
let rowsUpserted = 0;

for (let t = 0; t < universe.length; t++) {
  const { ticker, vehicle_type, currency } = universe[t];
  if (t > 0) await sleep(PAD_MS);
  try {
    const rows = await fetchFundamentals(ticker, vehicle_type, currency);
    if (rows.length) {
      const { error } = await sb.from("vehicle_fundamentals").upsert(rows, {
        onConflict: "ticker,period_end,period_type",
      });
      if (error) throw error;
      rowsUpserted += rows.length;
    }
    okCount++;
    if ((t + 1) % 10 === 0 || t === universe.length - 1) {
      console.log(`  ${t + 1}/${universe.length}  ${ticker.padEnd(8)}  +${rows.length} rows  (total: ${rowsUpserted})`);
    }
  } catch (err) {
    failCount++;
    console.warn(`  ! ${ticker}: ${err.message}`);
  }
}

console.log(`\n✓ fundamentals backfill complete: ${okCount}/${universe.length} ok, ${failCount} failed, ${rowsUpserted} rows upserted`);
console.log(`  wall time: ${Math.round((Date.now() - startedAt) / 1000)}s`);

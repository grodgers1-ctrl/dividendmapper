// Phase 4 Sprint 1 Day 3 Task 3.3 — 10y backfill for vehicle_prices.
// Self-contained ESM script (no TS imports — duplicates the FMP fetch+
// normalisation inline to avoid module-resolution complexity).
//
//   node dividendmapper/scripts/scoring/backfill-vehicle-prices.mjs
//   node dividendmapper/scripts/scoring/backfill-vehicle-prices.mjs --years 5    # shorter window
//   node dividendmapper/scripts/scoring/backfill-vehicle-prices.mjs --ticker O   # one ticker
//
// Idempotent — upsert on (ticker, observed_at) means re-running is safe.
// Expected wall time: ~3-5 min for 100 tickers at 1s pacing.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const PAD_MS = Number(process.env.FMP_TICKER_PAD_MS) || 1000;
const BATCH = 500;

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
const YEARS = Number(arg("years", "10"));
const ONLY_TICKER = arg("ticker", null);

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

function normalisePrice(close, currency) {
  return currency === "GBX" ? round4(close / 100) : close;
}

function isoOffset(daysBack) {
  const t = new Date();
  return {
    from: new Date(t.getTime() - daysBack * 86400000).toISOString().slice(0, 10),
    to: t.toISOString().slice(0, 10),
  };
}

async function fetchPrices(ticker) {
  const { from, to } = isoOffset(YEARS * 365);
  const url = `${FMP_BASE}/historical-price-eod/full?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${ticker}: HTTP ${r.status}`);
  const body = await r.json();
  if (!Array.isArray(body)) return [];
  return body;
}

async function upsertBatch(rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb.from("vehicle_prices").upsert(chunk, {
      onConflict: "ticker,observed_at",
    });
    if (error) throw error;
  }
}

// --- main ---
const startedAt = Date.now();
let q = sb.from("vehicle_universe").select("ticker, currency").eq("status", "active").eq("included_in_v1", true);
if (ONLY_TICKER) q = q.eq("ticker", ONLY_TICKER);
const { data: universe, error: uErr } = await q;
if (uErr) {
  console.error("universe query failed:", uErr);
  process.exit(1);
}
console.log(`→ backfilling ${universe.length} tickers, ${YEARS}y window…`);

let okCount = 0;
let failCount = 0;
let rowsUpserted = 0;

for (let t = 0; t < universe.length; t++) {
  const { ticker, currency } = universe[t];
  if (t > 0 && PAD_MS > 0) await sleep(PAD_MS);
  try {
    const bars = await fetchPrices(ticker);
    const priceRows = bars.map((bar) => ({
      ticker,
      observed_at: bar.date,
      close_price: normalisePrice(bar.close, currency),
    }));
    await upsertBatch(priceRows);
    rowsUpserted += priceRows.length;
    okCount++;
    if ((t + 1) % 10 === 0 || t === universe.length - 1) {
      console.log(`  ${t + 1}/${universe.length}  ${ticker.padEnd(8)}  +${priceRows.length} rows  (running total: ${rowsUpserted})`);
    }
  } catch (err) {
    failCount++;
    console.warn(`  ! ${ticker}: ${err.message}`);
  }
}

console.log(`\n✓ backfill complete: ${okCount}/${universe.length} ok, ${failCount} failed, ${rowsUpserted} rows upserted`);
console.log(`  wall time: ${Math.round((Date.now() - startedAt) / 1000)}s`);

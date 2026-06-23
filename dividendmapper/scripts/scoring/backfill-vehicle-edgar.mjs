// Phase 4 Sprint 1 Day 4 Task 4.3 — EDGAR backfill for US tickers.
//
//   node dividendmapper/scripts/scoring/backfill-vehicle-edgar.mjs
//
// For each US ticker in vehicle_universe (us_reit + us_bdc):
//   1. Fetch FMP profile → extract CIK
//   2. Hit SEC EDGAR submissions API → extract last 10-K / 10-Q / 8-K dates
//   3. Update vehicle_universe.cik + last_filing_date
//
// UK tickers skipped (no SEC filings).
// Pacing: 200ms between EDGAR calls (SEC rate limit is 10 req/s).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const EDGAR_BASE = "https://data.sec.gov/submissions";
const USER_AGENT = "DividendMapper grodgers1@googlemail.com";
const PAD_MS = 250;

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

async function fetchCik(ticker) {
  const url = `${FMP_BASE}/profile?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FMP profile ${ticker}: ${r.status}`);
  const body = await r.json();
  const cik = Array.isArray(body) ? body[0]?.cik : null;
  return cik || null;
}

function paddedCik(cik) {
  return String(cik).padStart(10, "0");
}

function findMostRecent(forms, dates, needle) {
  for (let i = 0; i < forms.length; i++) if (forms[i] === needle) return dates[i];
  return null;
}

async function fetchEdgar(cik) {
  const url = `${EDGAR_BASE}/CIK${paddedCik(cik)}.json`;
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!r.ok) throw new Error(`EDGAR ${cik}: ${r.status}`);
  const body = await r.json();
  const forms = body.filings?.recent?.form ?? [];
  const dates = body.filings?.recent?.filingDate ?? [];
  return {
    lastTenK: findMostRecent(forms, dates, "10-K"),
    lastTenQ: findMostRecent(forms, dates, "10-Q"),
    lastEightK: findMostRecent(forms, dates, "8-K"),
  };
}

const startedAt = Date.now();

const { data: universe, error: uErr } = await sb
  .from("vehicle_universe")
  .select("ticker, vehicle_type")
  .in("vehicle_type", ["us_reit", "us_bdc"])
  .eq("status", "active");
if (uErr) {
  console.error("universe query failed:", uErr);
  process.exit(1);
}
console.log(`→ EDGAR backfill: ${universe.length} US tickers`);

let okCount = 0;
let failCount = 0;
let cikLookupFailures = 0;

for (let t = 0; t < universe.length; t++) {
  const { ticker } = universe[t];
  if (t > 0) await sleep(PAD_MS);
  try {
    const cik = await fetchCik(ticker);
    if (!cik) {
      cikLookupFailures++;
      console.warn(`  ? ${ticker}: no CIK on FMP profile`);
      continue;
    }
    const { lastTenK, lastTenQ } = await fetchEdgar(cik);
    const last = [lastTenK, lastTenQ].filter(Boolean).sort().pop() ?? null;
    const { error } = await sb
      .from("vehicle_universe")
      .update({ cik, last_filing_date: last })
      .eq("ticker", ticker);
    if (error) throw error;
    okCount++;
    if ((t + 1) % 10 === 0 || t === universe.length - 1) {
      console.log(`  ${t + 1}/${universe.length}  ${ticker.padEnd(8)} cik=${cik} last=${last ?? "—"}`);
    }
  } catch (err) {
    failCount++;
    console.warn(`  ! ${ticker}: ${err.message}`);
  }
}

console.log(`\n✓ EDGAR backfill complete: ${okCount}/${universe.length} ok, ${failCount} fetch failures, ${cikLookupFailures} CIK lookups failed`);
console.log(`  wall time: ${Math.round((Date.now() - startedAt) / 1000)}s`);

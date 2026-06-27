// One-time backfill of ticker_price_history from FMP historical-price-full.
// Iterates the distinct ticker universe (holdings ∪ watchlist ∪ vehicle scores),
// fetches up to 1300 daily closes per ticker, upserts into ticker_price_history.
// Idempotent — safe to re-run for failed tickers.
//
// Usage:
//   set -a && source .env.local && set +a
//   node dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs [--only=AAPL,PYPL]

import { createClient } from "@supabase/supabase-js";

const FMP_KEY = process.env.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!FMP_KEY || !SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error(
    "Missing FMP_API_KEY, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false },
});
const KEEP_DAYS = 1300;
const SLEEP_MS = 100;

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(","))
  : null;

async function distinctTickers() {
  const [{ data: h }, { data: w }, { data: v }] = await Promise.all([
    supabase.from("holdings").select("ticker").is("archived_at", null),
    supabase.from("watchlist").select("ticker"),
    supabase.from("vehicle_scores").select("ticker"),
  ]);
  const set = new Set();
  for (const row of [...(h ?? []), ...(w ?? []), ...(v ?? [])]) {
    if (row?.ticker) set.add(row.ticker);
  }
  if (only) for (const t of [...set]) if (!only.has(t)) set.delete(t);
  if (only) for (const t of only) set.add(t);
  return [...set].sort();
}

const FMP_BASE = "https://financialmodelingprep.com/stable";

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchHistory(ticker) {
  const from = isoDaysAgo(KEEP_DAYS + 100); // small overshoot to cover non-trading days
  const to = new Date().toISOString().slice(0, 10);
  const url = `${FMP_BASE}/historical-price-eod/full?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP ${res.status} for ${ticker}`);
  const body = await res.json();
  // /stable returns an array directly (descending by date).
  const historical = Array.isArray(body) ? body : [];
  if (historical.length === 0) return { rows: [], currency: null };
  // GBp matches what FMP returns for .L tickers (raw pence); aria-labels read
  // naturally as "210.5 GBp" — same unit a UK retail investor sees in their
  // broker. No currency normalisation; sparklines are shape, not absolute.
  const currency = ticker.endsWith(".L") ? "GBp" : "USD";
  const rows = historical
    .slice(0, KEEP_DAYS)
    .map((r) => ({ ticker, trade_date: r.date, close: r.close, currency }))
    .filter(
      (r) =>
        Number.isFinite(r.close) && /^\d{4}-\d{2}-\d{2}$/.test(r.trade_date),
    );
  return { rows, currency };
}

async function upsertChunk(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("ticker_price_history")
      .upsert(chunk, { onConflict: "ticker,trade_date" });
    if (error) throw error;
  }
}

async function main() {
  const tickers = await distinctTickers();
  console.log(`Backfilling ${tickers.length} tickers`);
  let ok = 0;
  let miss = 0;
  let fail = 0;
  for (const ticker of tickers) {
    try {
      const { rows, currency } = await fetchHistory(ticker);
      if (rows.length === 0) {
        console.warn(`MISS ${ticker} -- no historical data`);
        miss++;
      } else {
        await upsertChunk(rows);
        console.log(`OK   ${ticker} -- ${rows.length} closes (${currency})`);
        ok++;
      }
    } catch (e) {
      console.error(`FAIL ${ticker} -- ${e.message}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
  console.log(`\nDone: ${ok} ok, ${miss} miss, ${fail} fail`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

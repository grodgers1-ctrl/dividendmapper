// ETF Lane Task 1.5 - One-shot backfill: populate current_price_currency on
// existing equity_score_history rows by pulling currency from FMP /stable/profile
// per unique ticker.
//
//   node dividendmapper/scripts/etf/backfill-score-history-currency.mjs
//
// Optional dry-run on a single ticker (does NOT write):
//   DRY_RUN_ONE=1 node dividendmapper/scripts/etf/backfill-score-history-currency.mjs
//
// Idempotent: the UPDATE is filtered by .is('current_price_currency', null)
// so re-running only touches rows that are still NULL.
//
// Pacing: 80ms between FMP calls = ~12 rps, well under the 750/min Premium quota.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FMP_KEY = process.env.FMP_API_KEY;
const DRY_RUN_ONE = process.env.DRY_RUN_ONE === "1";

if (!SUPABASE_URL || !SERVICE_KEY || !FMP_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FMP_API_KEY",
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull every row that still needs a currency. We only care about distinct
// tickers, so de-dupe after the fetch. PostgREST hard-caps a single page at
// 1000 rows so we paginate until the page comes back short.
async function fetchPendingTickers() {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await sb
      .from("equity_score_history")
      .select("ticker")
      .is("current_price_currency", null)
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) all.push(row.ticker);
    if (data.length < pageSize) break;
  }
  return all;
}

const allTickers = await fetchPendingTickers();
const unique = Array.from(new Set(allTickers)).sort();
const targets = DRY_RUN_ONE ? unique.slice(0, 1) : unique;

console.log(
  `Found ${allTickers.length} rows across ${unique.length} unique tickers needing backfill.`,
);
if (DRY_RUN_ONE) {
  console.log(`DRY_RUN_ONE active - only touching: ${targets.join(", ")}`);
}

let ok = 0;
let skip = 0;
let fail = 0;

for (const t of targets) {
  let currency = null;
  try {
    const r = await fetch(
      `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(t)}&apikey=${FMP_KEY}`,
    );
    if (!r.ok) {
      console.warn(`  - ${t}: FMP HTTP ${r.status}`);
      fail++;
      await sleep(80);
      continue;
    }
    const j = await r.json().catch(() => null);
    currency = Array.isArray(j) && j[0]?.currency ? j[0].currency : null;
  } catch (err) {
    console.warn(`  - ${t}: fetch threw ${err?.message ?? err}`);
    fail++;
    await sleep(80);
    continue;
  }

  if (!currency) {
    console.warn(`  - skip ${t} (no currency from FMP)`);
    skip++;
    await sleep(80);
    continue;
  }

  const { error: updateErr } = await sb
    .from("equity_score_history")
    .update({ current_price_currency: currency })
    .eq("ticker", t)
    .is("current_price_currency", null);

  if (updateErr) {
    console.warn(`  - ${t}: update failed ${updateErr.message}`);
    fail++;
  } else {
    console.log(`  ok ${t} -> ${currency}`);
    ok++;
  }

  await sleep(80);
}

console.log("");
console.log(
  `Backfill done. ok=${ok} skip=${skip} fail=${fail} of ${targets.length} tickers attempted.`,
);

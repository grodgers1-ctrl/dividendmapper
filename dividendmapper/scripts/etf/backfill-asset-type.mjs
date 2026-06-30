// ETF Lane Task 2.4 - One-shot backfill: set asset_type on tickers where it's
// still 'unknown' by reading FMP /stable/profile isEtf / isFund flags.
// Tickers that Task 2.3's seed already flipped to 'etf' are skipped (the
// filter `asset_type='unknown'` takes care of this).
//
//   node dividendmapper/scripts/etf/backfill-asset-type.mjs
//
// Optional dry-run on a single ticker (still writes that one row):
//   DRY_RUN_ONE=1 node dividendmapper/scripts/etf/backfill-asset-type.mjs
//
// Idempotent: the SELECT is filtered by .eq('asset_type', 'unknown') so
// re-runs only touch rows that are still 'unknown'.
//
// Pacing: 80ms between FMP calls = ~12 rps, well under the 750/min Premium quota.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- env: autoload .env.local so the script "just works" without a shell
// preamble (PowerShell has no `set -a && source` equivalent). Existing
// process.env values win, matching the sibling backfill scripts.
const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

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

const { data: rows, error: selectErr } = await sb
  .from("tickers")
  .select("ticker")
  .eq("asset_type", "unknown");

if (selectErr) {
  console.error(`Select failed: ${selectErr.message}`);
  process.exit(1);
}

const allTickers = (rows ?? []).map((r) => r.ticker).sort();
const targets = DRY_RUN_ONE ? allTickers.slice(0, 1) : allTickers;

console.log(`Found ${allTickers.length} tickers with asset_type='unknown'.`);
if (DRY_RUN_ONE) {
  console.log(`DRY_RUN_ONE active - only touching: ${targets.join(", ")}`);
}

let ok = 0;
let skip = 0;
let fail = 0;

for (const ticker of targets) {
  let profile = null;
  try {
    const r = await fetch(
      `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(ticker)}&apikey=${FMP_KEY}`,
    );
    if (!r.ok) {
      console.warn(`  - ${ticker}: FMP HTTP ${r.status}`);
      fail++;
      await sleep(80);
      continue;
    }
    const j = await r.json().catch(() => null);
    profile = Array.isArray(j) ? j[0] : null;
  } catch (err) {
    console.warn(`  - ${ticker}: fetch threw ${err?.message ?? err}`);
    fail++;
    await sleep(80);
    continue;
  }

  if (!profile) {
    console.warn(`  skip ${ticker} (no profile)`);
    skip++;
    await sleep(80);
    continue;
  }

  let type = "equity";
  if (profile.isEtf) type = "etf";
  else if (profile.isFund) type = "fund";

  const { error: updateErr } = await sb
    .from("tickers")
    .update({ asset_type: type })
    .eq("ticker", ticker);

  if (updateErr) {
    console.warn(`  ${ticker}: ${updateErr.message}`);
    fail++;
  } else {
    console.log(`  ok ${ticker} -> ${type}`);
    ok++;
  }

  await sleep(80);
}

console.log("");
console.log(
  `Backfill done. ok=${ok} skip=${skip} fail=${fail} of ${targets.length} tickers attempted.`,
);

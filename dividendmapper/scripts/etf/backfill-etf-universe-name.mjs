// ETF Lane Cleanup #38 - One-shot backfill: replace placeholder etf_universe.name
// values (where name === ticker, left over from the seed importer) with real
// fund names fetched from FMP /stable/profile (the `companyName` field).
//
//   node dividendmapper/scripts/etf/backfill-etf-universe-name.mjs
//
// Optional dry-run on a single ticker (still writes that one row):
//   DRY_RUN_ONE=1 node dividendmapper/scripts/etf/backfill-etf-universe-name.mjs
//
// Idempotent: the JS-side filter skips rows where name !== ticker, and the
// UPDATE re-asserts `.eq('name', ticker)` so concurrent edits aren't overwritten.
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

// PostgREST can't compare two columns directly, so fetch the small universe
// (~80 rows) and filter in JS. Re-runs skip rows that already have a real
// name (name !== ticker).
const { data: allRows, error: selectErr } = await sb
  .from("etf_universe")
  .select("ticker, name");

if (selectErr) {
  console.error(`Select failed: ${selectErr.message}`);
  process.exit(1);
}

const placeholderRows = (allRows ?? []).filter((r) => r.name === r.ticker);
const targets = DRY_RUN_ONE ? placeholderRows.slice(0, 1) : placeholderRows;

console.log(
  `Found ${placeholderRows.length} etf_universe rows with name===ticker placeholder.`,
);
if (DRY_RUN_ONE) {
  console.log(`DRY_RUN_ONE active - only touching: ${targets.map((t) => t.ticker).join(", ")}`);
}

let ok = 0;
let skip = 0;
let fail = 0;

for (const row of targets) {
  const ticker = row.ticker;
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

  const newName = profile?.companyName;
  if (!newName || typeof newName !== "string" || newName === ticker) {
    console.warn(`  skip ${ticker} (no usable companyName from FMP)`);
    skip++;
    await sleep(80);
    continue;
  }

  // Double-guard: only overwrite the placeholder. If something else updated
  // this row between the SELECT and the UPDATE, the .eq("name", ticker)
  // makes the UPDATE a no-op rather than clobbering a real name.
  const { error: updateErr } = await sb
    .from("etf_universe")
    .update({ name: newName })
    .eq("ticker", ticker)
    .eq("name", ticker);

  if (updateErr) {
    console.warn(`  ${ticker}: ${updateErr.message}`);
    fail++;
  } else {
    console.log(`  ok ${ticker} -> ${newName}`);
    ok++;
  }

  await sleep(80);
}

console.log("");
console.log(
  `Backfill done. ok=${ok} skip=${skip} fail=${fail} of ${targets.length} tickers attempted.`,
);

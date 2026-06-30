// ETF Lane Task 2.3 - One-shot seed importer: reads data/etf/seed-80.csv
// and upserts the 80 curated tickers into `tickers` (asset_type='etf') and
// `etf_universe`.
//
//   node dividendmapper/scripts/etf/seed-universe.mjs
//
// Optional dry-run on the first ticker only (still writes that one row):
//   DRY_RUN_ONE=1 node dividendmapper/scripts/etf/seed-universe.mjs
//
// Idempotent: both upserts use onConflict='ticker' so re-running is safe.

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
const DRY_RUN_ONE = process.env.DRY_RUN_ONE === "1";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- CSV parse (naive split on ',' — seed values are hand-curated to avoid
// embedded commas; if a value ever needs one, swap in a real CSV parser).
const csv = readFileSync(new URL("../../data/etf/seed-80.csv", import.meta.url), "utf8");
const lines = csv.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(",");
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

const allRows = lines.slice(1).map((line) => {
  const cols = line.split(",");
  return {
    ticker: cols[idx.ticker],
    exchange: cols[idx.exchange],
    family: cols[idx.family],
    distribution_policy: cols[idx.distribution_policy],
    domicile: cols[idx.domicile],
    benchmark: cols[idx.benchmark],
  };
});

const rows = DRY_RUN_ONE ? allRows.slice(0, 1) : allRows;

console.log(`Seeding ${rows.length} ETF tickers...`);
if (DRY_RUN_ONE) {
  console.log(`DRY_RUN_ONE active - only touching: ${rows[0].ticker}`);
}

let ok = 0;
let fail = 0;

for (const r of rows) {
  const { error: te } = await sb
    .from("tickers")
    .upsert({ ticker: r.ticker, asset_type: "etf" }, { onConflict: "ticker" });
  if (te) {
    console.warn(`  tickers ${r.ticker}: ${te.message}`);
    fail++;
    continue;
  }

  const { error: ue } = await sb.from("etf_universe").upsert(
    {
      ticker: r.ticker,
      name: r.ticker,
      family: r.family,
      distribution_policy: r.distribution_policy,
      domicile: r.domicile,
      benchmark: r.benchmark,
      manual_override: true,
    },
    { onConflict: "ticker" },
  );
  if (ue) {
    console.warn(`  etf_universe ${r.ticker}: ${ue.message}`);
    fail++;
  } else {
    console.log(`  ok ${r.ticker}`);
    ok++;
  }
}

console.log("");
console.log(`Seed complete. ok=${ok} fail=${fail} of ${rows.length} tickers attempted.`);

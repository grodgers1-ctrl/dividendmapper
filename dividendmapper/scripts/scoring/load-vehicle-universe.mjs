// Phase 4 Sprint 1 Day 1 Task 1.4 — Universe loader.
//
//   node dividendmapper/scripts/scoring/load-vehicle-universe.mjs
//
// Reads:
//   - planning/research/vehicle-universe-seed.json (emitted by Task 1.1)
//   - dividendmapper/lib/scoring/data/uk-reit-classification.json (Task 1.2)
//
// Writes:
//   - public.vehicle_universe (idempotent upsert on ticker PK)
//
// Reports per-family counts and re-asserts anchor presence before the upsert.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ANCHORS = {
  us_reit: ["O", "PLD", "AMT", "EQIX", "WELL", "SPG", "EQR", "AVB", "EXR", "VICI"],
  us_bdc: ["ARCC", "MAIN", "OBDC", "HTGC"],
  uk_reit: ["BLND.L", "LAND.L", "SGRO.L", "UTG.L", "BBOX.L", "PHP.L"],
};

// --- env ---
const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

// --- inputs ---
const seedPath = new URL("../../../planning/research/vehicle-universe-seed.json", import.meta.url);
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const classPath = new URL("../../lib/scoring/data/uk-reit-classification.json", import.meta.url);
const ukClass = JSON.parse(readFileSync(classPath, "utf8"));

// --- enrichment: weave UK classification notes into universe rows ---
const enriched = seed.universe.map((row) => {
  if (row.vehicle_type !== "uk_reit") return row;
  const cls = ukClass[row.ticker];
  if (!cls) {
    console.warn(`  ! UK REIT ${row.ticker} missing from classification JSON — proceeding without`);
    return row;
  }
  return {
    ...row,
    sub_sector: cls.propertyType, // override FMP-derived sub_sector with manual classification
    notes: cls.geographicScope === "overseas_exposed"
      ? `geographicScope=overseas_exposed (${cls.notes || "see uk-reit-classification.json"})`
      : "geographicScope=uk_only",
  };
});

// --- anchor re-check ---
for (const [fam, expected] of Object.entries(ANCHORS)) {
  const present = new Set(enriched.filter((r) => r.vehicle_type === fam).map((r) => r.ticker));
  const missing = expected.filter((a) => !present.has(a));
  if (missing.length) {
    console.error(`✗ [${fam}] anchors missing: ${missing.join(", ")}`);
    process.exit(1);
  }
}
console.log("✓ all anchors present across all three families");

// --- supabase upsert ---
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const rows = enriched.map((r) => ({
  ticker: r.ticker,
  vehicle_type: r.vehicle_type,
  display_name: r.display_name,
  exchange: r.exchange,
  currency: r.currency,
  sub_sector: r.sub_sector,
  market_cap_at_seed: r.market_cap_at_seed,
  notes: r.notes ?? null,
}));

const { error } = await sb.from("vehicle_universe").upsert(rows, { onConflict: "ticker" });
if (error) {
  console.error("✗ upsert failed:", error);
  process.exit(1);
}

// --- post-load count check ---
const { data: counts, error: cErr } = await sb
  .from("vehicle_universe")
  .select("vehicle_type, ticker");
if (cErr) {
  console.error("✗ count query failed:", cErr);
  process.exit(1);
}
const tally = counts.reduce((acc, x) => ((acc[x.vehicle_type] = (acc[x.vehicle_type] || 0) + 1), acc), {});
console.log("✓ vehicle_universe row counts after upsert:", JSON.stringify(tally));
console.log(`✓ upserted ${rows.length} rows`);

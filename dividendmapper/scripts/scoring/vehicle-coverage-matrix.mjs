// Phase 4 Sprint 1 Day 5 Task 5.1 — Coverage matrix.
// Emits planning/research/vehicle-coverage-sprint1.md for the PR body.

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ANCHORS = {
  us_reit: ["O", "PLD", "AMT"],
  us_bdc: ["ARCC", "MAIN", "OBDC"],
  uk_reit: ["BLND.L", "LAND.L", "SGRO.L"],
};

const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const startedAt = Date.now();

const { data: universe } = await sb
  .from("vehicle_universe")
  .select("ticker, vehicle_type, display_name, sub_sector, currency, last_filing_date, market_cap_at_seed")
  .eq("status", "active")
  .eq("included_in_v1", true)
  .order("vehicle_type")
  .order("market_cap_at_seed", { ascending: false });

// Bulk-fetch fundamentals, aggregate the latest per ticker client-side.
const { data: allFund } = await sb
  .from("vehicle_fundamentals")
  .select("ticker, period_end, period_type, nav_per_share, debt_total, equity_total, ebitda, interest_expense")
  .order("period_end", { ascending: false });

const latestByTicker = new Map();
for (const row of allFund || []) {
  if (!latestByTicker.has(row.ticker)) latestByTicker.set(row.ticker, row);
}

// Price-row counts per ticker (last 90 days). Per-ticker count query
// avoids the default 1000-row .select() cap that would silently truncate
// the multi-ticker bulk fetch.
const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
const priceCount90 = new Map();
for (const u of universe || []) {
  const { count } = await sb
    .from("vehicle_prices")
    .select("*", { count: "exact", head: true })
    .eq("ticker", u.ticker)
    .gte("observed_at", ninetyDaysAgo);
  priceCount90.set(u.ticker, count || 0);
}

const CRITICAL_FIELDS = ["nav_per_share", "debt_total", "equity_total", "ebitda", "interest_expense"];

function classifyTicker(t) {
  const fund = latestByTicker.get(t.ticker);
  const priced = (priceCount90.get(t.ticker) || 0) >= 40; // ~60 trading days in 90 cal
  const fundFields = fund ? CRITICAL_FIELDS.filter((f) => fund[f] != null).length : 0;
  const usHasEdgar = (t.vehicle_type === "us_reit" || t.vehicle_type === "us_bdc")
    ? !!t.last_filing_date
    : true;
  let label;
  if (priced && fundFields === 5 && usHasEdgar) label = "full";
  else if (priced && fundFields >= 3) label = "partial";
  else label = "sparse";
  return { ...t, fund, fundFields, priced, usHasEdgar, label, prices90: priceCount90.get(t.ticker) || 0 };
}

const enriched = (universe || []).map(classifyTicker);

const summary = enriched.reduce((acc, x) => {
  const key = `${x.vehicle_type}_${x.label}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const lines = [];
lines.push(`# Phase 4 Sprint 1 Coverage Matrix`);
lines.push(``);
lines.push(`Generated: ${new Date(startedAt).toISOString()}  Tickers: ${enriched.length}`);
lines.push(``);
lines.push(`## Summary by family × data quality`);
lines.push(``);
lines.push(`| Family | Full | Partial | Sparse |`);
lines.push(`|---|---:|---:|---:|`);
for (const fam of ["us_reit", "us_bdc", "uk_reit"]) {
  lines.push(`| ${fam} | ${summary[`${fam}_full`] || 0} | ${summary[`${fam}_partial`] || 0} | ${summary[`${fam}_sparse`] || 0} |`);
}
lines.push(``);

lines.push(`## Anchor sanity check`);
lines.push(``);
lines.push(`9 anchor tickers (3 per family) must show full data for Sprint 2 to proceed.`);
lines.push(``);
lines.push(`| Anchor | Family | Latest period | NAV/sh | Debt | Equity | EBITDA | Int.Exp. | Verdict |`);
lines.push(`|---|---|---|---:|---:|---:|---:|---:|---|`);
for (const fam of ["us_reit", "us_bdc", "uk_reit"]) {
  for (const ticker of ANCHORS[fam]) {
    const row = enriched.find((x) => x.ticker === ticker);
    if (!row || !row.fund) {
      lines.push(`| ${ticker} | ${fam} | — | — | — | — | — | — | ❌ MISSING |`);
      continue;
    }
    const f = row.fund;
    const num = (v, scale = 1) => v == null ? "—" : (v / scale).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const verdict = row.label === "full" ? "✅" : row.label === "partial" ? "⚠️ partial" : "❌ sparse";
    lines.push(`| ${ticker} | ${fam} | ${f.period_end} | ${num(f.nav_per_share)} | ${num(f.debt_total, 1e9)}B | ${num(f.equity_total, 1e9)}B | ${num(f.ebitda, 1e6)}M | ${num(f.interest_expense, 1e6)}M | ${verdict} |`);
  }
}
lines.push(``);

lines.push(`## Sparse / partial tickers`);
lines.push(``);
const problematic = enriched.filter((x) => x.label !== "full");
if (!problematic.length) {
  lines.push(`None.`);
} else {
  lines.push(`| Ticker | Family | Label | Price rows (90d) | Fund fields | EDGAR | Reason hint |`);
  lines.push(`|---|---|---|---:|---:|:---:|---|`);
  for (const t of problematic) {
    const edgar = (t.vehicle_type === "us_reit" || t.vehicle_type === "us_bdc")
      ? (t.usHasEdgar ? "✓" : "✗")
      : "n/a";
    const reasons = [];
    if (!t.priced) reasons.push(`only ${t.prices90} price rows`);
    if (t.fundFields < 5) reasons.push(`${t.fundFields}/5 fundamentals fields`);
    if ((t.vehicle_type === "us_reit" || t.vehicle_type === "us_bdc") && !t.usHasEdgar) reasons.push("no EDGAR filing date");
    lines.push(`| ${t.ticker} | ${t.vehicle_type} | ${t.label} | ${t.prices90} | ${t.fundFields}/5 | ${edgar} | ${reasons.join(", ")} |`);
  }
}
lines.push(``);

lines.push(`## Counts query (Sprint 1 verify)`);
lines.push(``);
lines.push(`\`\`\`sql`);
lines.push(`select vehicle_type, count(*) from vehicle_universe`);
lines.push(`where included_in_v1 group by vehicle_type;`);
lines.push(`\`\`\``);
lines.push(``);
lines.push(`Result this run:`);
lines.push(``);
const counts = enriched.reduce((acc, x) => ((acc[x.vehicle_type] = (acc[x.vehicle_type] || 0) + 1), acc), {});
for (const [k, v] of Object.entries(counts)) lines.push(`- ${k}: ${v}`);

const outPath = new URL("../../../planning/research/vehicle-coverage-sprint1.md", import.meta.url);
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`✓ wrote coverage matrix → ${outPath.pathname.replace(/^.*planning/, "planning")}`);

// Also stdout the anchor table for quick eyeball
console.log("\n--- ANCHOR SANITY (quick view) ---");
for (const fam of ["us_reit", "us_bdc", "uk_reit"]) {
  for (const ticker of ANCHORS[fam]) {
    const row = enriched.find((x) => x.ticker === ticker);
    console.log(`  ${ticker.padEnd(8)} ${fam.padEnd(8)} label=${row?.label ?? "?"}  fund=${row?.fundFields ?? 0}/5  prices90=${row?.prices90 ?? 0}`);
  }
}
console.log(`\nDuration: ${Math.round((Date.now() - startedAt) / 1000)}s`);

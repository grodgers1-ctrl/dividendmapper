// Carry-over #2 probe: for Glenn's actual portfolio, ask FMP what next ex-div
// it knows about, and compare against equity_scores.next_ex_div_date in
// Supabase. Tells us whether the dashboard gap is FMP coverage, our cron, or
// announcement timing.
//
// Usage (Bash from repo root):
//   set -a && source dividendmapper/.env.local && set +a
//   node scripts/sanity/probe-fmp-dividends-calendar.mjs
//
// Or PowerShell:
//   Get-Content dividendmapper/.env.local | ForEach-Object {
//     if ($_ -match '^([^#=]+)=(.*)$') { $env:($matches[1].Trim()) = $matches[2].Trim() }
//   }
//   node scripts/sanity/probe-fmp-dividends-calendar.mjs
//
// Falls back to reading dividendmapper/.env.local directly if env vars are
// missing — useful when the parent shell isn't sourced.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", "..", "dividendmapper", ".env.local");
let envFile = {};
try {
  envFile = Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
} catch { /* ignore */ }

const FMP_API_KEY = process.env.FMP_API_KEY || envFile.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envFile.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY;
const USER_EMAIL = process.argv[2] || "grodgers1@googlemail.com";

if (!FMP_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env (FMP_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Supabase ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

function isoOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fmpCalendar(from, to) {
  const u = `https://financialmodelingprep.com/stable/dividends-calendar?from=${from}&to=${to}&apikey=${FMP_API_KEY}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`FMP calendar HTTP ${r.status}`);
  return r.json();
}

async function fmpDividends(symbol) {
  const u = `https://financialmodelingprep.com/stable/dividends?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_API_KEY}`;
  const r = await fetch(u);
  if (!r.ok) return [];
  return r.json();
}

console.log(`Resolving user_id for ${USER_EMAIL}`);
const profile = await sb(`profiles?select=id&email=eq.${encodeURIComponent(USER_EMAIL)}`);
if (profile.length === 0) {
  console.error("No profile.");
  process.exit(1);
}
const userId = profile[0].id;

console.log(`Reading active holdings`);
const holdings = await sb(`holdings?select=ticker&user_id=eq.${userId}&archived_at=is.null`);
const tickers = [...new Set(holdings.map((h) => h.ticker))].sort();
console.log(`  ${tickers.length} unique tickers`);

console.log(`Reading equity_scores.next_ex_div_date for these tickers`);
const tickerList = `(${tickers.map((t) => `"${t}"`).join(",")})`;
const scores = await sb(`equity_scores?select=ticker,next_ex_div_date,next_ex_div_amount&ticker=in.${encodeURIComponent(tickerList)}`);
const scoreByTicker = Object.fromEntries(scores.map((s) => [s.ticker, s]));

const today = isoOffset(0);
const horizonDays = 90;
const to = isoOffset(horizonDays);
console.log(`\nFetching FMP /stable/dividends-calendar ${today} → ${to}`);
const calendar = await fmpCalendar(today, to);
const calByTicker = new Map();
for (const r of calendar) {
  if (r.date < today) continue;
  const arr = calByTicker.get(r.symbol) ?? [];
  arr.push(r);
  calByTicker.set(r.symbol, arr);
}

console.log(`\nPer-ticker breakdown:\n`);
console.log("ticker      DB next_ex     FMP cal 90d   FMP historical next  verdict");
console.log("─".repeat(85));

let populated = 0;
let fmpKnowsButDbMisses = 0;
let fmpUnknownToo = 0;

for (const t of tickers) {
  const dbDate = scoreByTicker[t]?.next_ex_div_date ?? "—";
  const calHits = (calByTicker.get(t) ?? []).sort((a, b) => a.date.localeCompare(b.date));
  const calNext = calHits.length === 0 ? "—" : calHits[0].date;
  const hist = await fmpDividends(t);
  const histDated = Array.isArray(hist) ? hist.map((h) => h.date).filter(Boolean).sort() : [];
  const histNext = histDated.find((d) => d >= today) ?? "—";

  let verdict = "";
  if (dbDate !== "—") { populated++; verdict = "OK in DB"; }
  else if (calNext !== "—" || histNext !== "—") { fmpKnowsButDbMisses++; verdict = "FMP HAS IT, DB DOES NOT"; }
  else { fmpUnknownToo++; verdict = "FMP doesn't know either (announce-timing)"; }

  console.log(`  ${t.padEnd(10)} ${dbDate.padEnd(13)} ${calNext.padEnd(13)} ${histNext.padEnd(20)} ${verdict}`);
}

console.log("\n─".repeat(85));
console.log(`Summary for ${USER_EMAIL}:`);
console.log(`  Holdings:                                ${tickers.length}`);
console.log(`  DB has next_ex_div_date:                 ${populated}`);
console.log(`  FMP knows but DB missing (REAL BUG):     ${fmpKnowsButDbMisses}`);
console.log(`  FMP doesn't know either (announce gap):  ${fmpUnknownToo}`);

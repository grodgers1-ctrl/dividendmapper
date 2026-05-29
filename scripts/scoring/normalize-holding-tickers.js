// One-off backfill script — run from repo root:
//   set -a && source dividendmapper/.env.local && set +a
//   node scripts/scoring/normalize-holding-tickers.js [--dry-run]
//
// Finds every distinct holdings.ticker, queries FMP search-symbol to resolve
// the best-match canonical symbol (preferring .L for LSE names), and UPDATEs
// any holdings rows where ticker != resolved symbol. Idempotent.

const FMP_BASE = "https://financialmodelingprep.com/stable";
const EXCHANGE_RANK = { LSE: 1, NASDAQ: 2, NYSE: 2, NYSEARCA: 2, AMEX: 3, TSX: 4, OTC: 9 };

export function pickBestSymbol(query, results) {
  const upperQ = query.toUpperCase();
  const filtered = results.filter((r) => {
    const upS = r.symbol.toUpperCase();
    return upS === upperQ || upS.startsWith(upperQ + ".") || upS.split(".")[0] === upperQ;
  });
  if (filtered.length === 0) return null;
  const sorted = filtered.sort(
    (a, b) =>
      (EXCHANGE_RANK[a.exchange?.toUpperCase()] ?? 7) -
      (EXCHANGE_RANK[b.exchange?.toUpperCase()] ?? 7),
  );
  return sorted[0].symbol;
}

async function fetchSearch(query, apiKey) {
  const url = `${FMP_BASE}/search-symbol?query=${encodeURIComponent(query)}&limit=10&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP search failed: ${res.status}`);
  return res.json();
}

async function fetchHoldingsTickers(supabaseUrl, serviceRoleKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/holdings?select=ticker`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase holdings query failed: ${res.status}`);
  const rows = await res.json();
  return Array.from(new Set(rows.map((r) => r.ticker))).sort();
}

async function updateHoldings(supabaseUrl, serviceRoleKey, fromTicker, toTicker) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/holdings?ticker=eq.${encodeURIComponent(fromTicker)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ ticker: toTicker }),
    },
  );
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { FMP_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!FMP_API_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing env: FMP_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const tickers = await fetchHoldingsTickers(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log(`Found ${tickers.length} distinct tickers:`, tickers.join(", "));

  for (const t of tickers) {
    const results = await fetchSearch(t, FMP_API_KEY);
    const best = pickBestSymbol(t, results);
    if (!best) {
      console.warn(`  ${t}: NO MATCH — leaving as-is`);
      continue;
    }
    if (best === t) {
      console.log(`  ${t}: already canonical`);
      continue;
    }
    if (dryRun) {
      console.log(`  ${t} → ${best} (dry-run)`);
    } else {
      const updated = await updateHoldings(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, t, best);
      console.log(`  ${t} → ${best} (${updated.length} rows updated)`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const invokedDirectly =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

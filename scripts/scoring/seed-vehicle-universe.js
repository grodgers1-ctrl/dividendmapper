// Standalone Node 20+ script. Run from repo root:
//   node scripts/scoring/seed-vehicle-universe.js
//
// Phase 4 Sprint 1 Day 1 — Universe lock script.
//
// Emits planning/research/vehicle-universe-seed.json containing the three V1
// vehicle families:
//   - Top 50 US equity REITs by market cap (FMP screener, sector=Real Estate,
//     NYSE+NASDAQ, mktCap > $500M)
//   - Top 25 US BDCs by market cap (curated candidate list, market-cap sorted;
//     FMP has no BDC industry tag — Asset Management bucket mixes BDCs with
//     180 other asset-management firms, so we lock the candidate set here)
//   - Top 25 UK REITs by market cap (FMP screener, sector=Real Estate, LSE)
//
// Also asserts ANCHOR_TICKERS are all present in the emitted lists. If any
// anchor is missing the script exits non-zero — Sprint 1 Day 1 Gate Decision.
//
// The emitted JSON is consumed by scripts/scoring/load-vehicle-universe.ts
// (Task 1.4) which upserts into the vehicle_universe table on Supabase.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FMP_BASE = "https://financialmodelingprep.com/stable";

const ANCHOR_TICKERS = {
  us_reit: ["O", "PLD", "AMT", "EQIX", "WELL", "SPG", "EQR", "AVB", "EXR", "VICI"],
  us_bdc: ["ARCC", "MAIN", "OBDC", "HTGC"],
  // UTG.L is how FMP exposes The Unite Group plc (LSE primary ticker UNITE).
  uk_reit: ["BLND.L", "LAND.L", "SGRO.L", "UTG.L", "BBOX.L", "PHP.L"],
};

// Curated BDC universe — FMP's Asset Management industry tag is too coarse
// (BDCs sit alongside 180 other asset-managers), so we pin the candidate set
// to known publicly-traded US BDCs and rank by FMP-reported market cap.
const BDC_CANDIDATES = [
  "ARCC", "MAIN", "OBDC", "FSK", "BXSL", "GBDC", "HTGC", "NMFC",
  "OXSQ", "PSEC", "BCSF", "CGBD", "TSLX", "GAIN", "TRIN", "GLAD",
  "CSWC", "CION", "PFLT", "PNNT", "SLRC", "SAR", "MFIC", "RUNL",
  "KIO", "GECC", "CCAP", "CSWC", "MRCC", "SCM", "FDUS", "SLRX",
  "PSBD", "BBDC", "CLDT",
];

// Phase 4 plan §UI direction recognises these sub-sector buckets. The FMP
// `industry` field already gives "REIT - Healthcare Facilities" / "REIT -
// Industrial" / "REIT - Specialty" etc — we re-bucket to the plan's taxonomy.
const REIT_SUBSECTOR_MAP = {
  "REIT - Healthcare Facilities": "healthcare",
  "REIT - Industrial": "industrial",
  "REIT - Office": "office",
  "REIT - Residential": "residential",
  "REIT - Retail": "retail",
  "REIT - Specialty": "specialty",
  "REIT - Diversified": "diversified",
  "REIT - Hotel & Motel": "hotels",
  "REIT - Mortgage": "mortgage",
};

function envApiKey() {
  // Read .env.local from dividendmapper/ directly so script runs without env
  // pre-loading (Glenn's PowerShell can't do `set -a && source`).
  const envPath = path.join(__dirname, "..", "..", "dividendmapper", ".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const m = env.match(/^FMP_API_KEY=(.+)$/m);
  if (!m) throw new Error("FMP_API_KEY missing from dividendmapper/.env.local");
  return m[1].trim();
}

async function fmp(pathname, params, apiKey) {
  const url = new URL(`${FMP_BASE}/${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${pathname} returned ${r.status}: ${await r.text()}`);
  return r.json();
}

function classifyReitSubSector(industry) {
  return REIT_SUBSECTOR_MAP[industry] ?? "other";
}

async function fetchUsReits(apiKey) {
  // NB: we deliberately omit isFund=false because FMP's name-based fund
  // heuristic over-classifies anything with "REIT" in its company name as a
  // Fund (e.g. Tritax Big Box REIT plc, Custodian REIT Plc). The industry
  // post-filter below is the authoritative REIT signal.
  const rows = await fmp("company-screener", {
    sector: "Real Estate",
    exchange: "NYSE,NASDAQ",
    isEtf: "false",
    isActivelyTrading: "true",
    marketCapMoreThan: "500000000",
    limit: "300",
  }, apiKey);
  return rows
    .filter((x) => x.industry?.startsWith("REIT"))
    .slice(0, 50)
    .map((x) => ({
      ticker: x.symbol,
      vehicle_type: "us_reit",
      display_name: x.companyName,
      exchange: x.exchangeShortName === "NYSE" ? "NYSE" : "NASDAQ",
      currency: "USD",
      sub_sector: classifyReitSubSector(x.industry),
      market_cap_at_seed: x.marketCap,
      fmp_industry: x.industry,
    }));
}

async function fetchUkReits(apiKey) {
  // country=GB filters out the FMP-internal `0xxx.L` cross-listing tickers
  // that pollute the raw LSE exchange list with US companies. isFund=false is
  // dropped because FMP miscategorises name-tagged REITs (e.g. BBOX.L
  // "Tritax Big Box REIT plc") as funds.
  const rows = await fmp("company-screener", {
    sector: "Real Estate",
    exchange: "LSE",
    country: "GB",
    isEtf: "false",
    isActivelyTrading: "true",
    marketCapMoreThan: "100000000",
    limit: "200",
  }, apiKey);
  return rows
    .filter((x) => x.industry?.startsWith("REIT"))
    .slice(0, 25)
    .map((x) => ({
      ticker: x.symbol,
      vehicle_type: "uk_reit",
      display_name: x.companyName,
      exchange: "LSE",
      currency: x.price && x.price > 100 ? "GBX" : "GBP", // LSE typically quotes in pence
      sub_sector: classifyReitSubSector(x.industry),
      market_cap_at_seed: x.marketCap,
      fmp_industry: x.industry,
    }));
}

async function fetchUsBdcs(apiKey) {
  // Resolve every candidate via profile endpoint to pull live market cap.
  const unique = Array.from(new Set(BDC_CANDIDATES));
  const profiles = [];
  for (const sym of unique) {
    try {
      const res = await fmp("profile", { symbol: sym }, apiKey);
      const p = Array.isArray(res) ? res[0] : null;
      if (!p) continue;
      if (!p.isActivelyTrading) continue;
      if (!(p.marketCap > 0)) continue;
      profiles.push(p);
    } catch (err) {
      console.warn(`  ! profile failed for ${sym}: ${err.message}`);
    }
  }
  profiles.sort((a, b) => b.marketCap - a.marketCap);
  return profiles.slice(0, 25).map((p) => ({
    ticker: p.symbol,
    vehicle_type: "us_bdc",
    display_name: p.companyName,
    exchange: p.exchangeShortName === "NYSE" ? "NYSE" : "NASDAQ",
    currency: "USD",
    sub_sector: "business_development",
    market_cap_at_seed: p.marketCap,
    fmp_industry: p.industry,
  }));
}

function assertAnchors(family, picked, anchors) {
  const symbols = new Set(picked.map((x) => x.ticker));
  const missing = anchors.filter((a) => !symbols.has(a));
  if (missing.length) {
    throw new Error(`[${family}] anchor tickers missing: ${missing.join(", ")} — debug the screener before proceeding`);
  }
}

(async () => {
  const apiKey = envApiKey();
  console.log("→ Fetching US REIT universe (sector=Real Estate, NYSE+NASDAQ)…");
  const usReits = await fetchUsReits(apiKey);
  console.log(`  ${usReits.length} US REITs picked (top by mktCap)`);
  assertAnchors("us_reit", usReits, ANCHOR_TICKERS.us_reit);
  console.log(`  ✓ all ${ANCHOR_TICKERS.us_reit.length} anchors present`);

  console.log("→ Fetching UK REIT universe (sector=Real Estate, LSE)…");
  const ukReits = await fetchUkReits(apiKey);
  console.log(`  ${ukReits.length} UK REITs picked (top by mktCap)`);
  assertAnchors("uk_reit", ukReits, ANCHOR_TICKERS.uk_reit);
  console.log(`  ✓ all ${ANCHOR_TICKERS.uk_reit.length} anchors present`);

  console.log("→ Fetching US BDC universe (curated candidate list)…");
  const usBdcs = await fetchUsBdcs(apiKey);
  console.log(`  ${usBdcs.length} US BDCs picked (top by mktCap)`);
  assertAnchors("us_bdc", usBdcs, ANCHOR_TICKERS.us_bdc);
  console.log(`  ✓ all ${ANCHOR_TICKERS.us_bdc.length} anchors present`);

  const seed = {
    generated_at: new Date().toISOString(),
    counts: { us_reit: usReits.length, us_bdc: usBdcs.length, uk_reit: ukReits.length },
    universe: [...usReits, ...usBdcs, ...ukReits],
  };

  const outPath = path.join(__dirname, "..", "..", "planning", "research", "vehicle-universe-seed.json");
  fs.writeFileSync(outPath, JSON.stringify(seed, null, 2));
  console.log(`\n✓ Wrote ${seed.universe.length} rows to ${path.relative(process.cwd(), outPath)}`);
})().catch((err) => {
  console.error("✗ seed-vehicle-universe failed:", err.message);
  process.exit(1);
});

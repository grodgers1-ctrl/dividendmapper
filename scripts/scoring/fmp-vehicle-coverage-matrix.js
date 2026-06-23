// Standalone Node 20+ script. Run from repo root:
//   set -a && source dividendmapper/.env.local && set +a
//   node scripts/scoring/fmp-vehicle-coverage-matrix.js > planning/research/fmp-vehicle-coverage-matrix.md
//
// Phase 4 (Income Vehicle Scoring) pre-flight probe.
// Hits the FMP /stable/ endpoints needed to compute Resilience Score for three
// vehicle families: US equity REITs, US BDCs, UK REITs. Emits a markdown
// coverage matrix + per-family pass/fail gates.
//
// Decision rule (per planning/08-phase-4-income-vehicle-scoring.md Open
// Question 1): each family must clear ≥80% on its critical-endpoint subset
// for the family to be in V1 scope. Anything below 80% → escalate to Glenn
// before committing Sprint 1.

const FMP_BASE = "https://financialmodelingprep.com/stable";

// ----- Universe samples (8 per family) ----------------------------------

const TICKERS = [
  // US equity REITs — diverse across sub-sectors
  { symbol: "O",     family: "us_reit", subSector: "net_lease" },
  { symbol: "PLD",   family: "us_reit", subSector: "industrial" },
  { symbol: "AMT",   family: "us_reit", subSector: "telecoms" },
  { symbol: "EQIX",  family: "us_reit", subSector: "data_centre" },
  { symbol: "WELL",  family: "us_reit", subSector: "healthcare" },
  { symbol: "SPG",   family: "us_reit", subSector: "retail" },
  { symbol: "EQR",   family: "us_reit", subSector: "residential" },
  { symbol: "EXR",   family: "us_reit", subSector: "self_storage" },

  // US BDCs — top by market cap
  { symbol: "ARCC",  family: "us_bdc",  subSector: "diversified" },
  { symbol: "MAIN",  family: "us_bdc",  subSector: "lower_middle_market" },
  { symbol: "OBDC",  family: "us_bdc",  subSector: "diversified" },
  { symbol: "HTGC",  family: "us_bdc",  subSector: "venture" },
  { symbol: "GBDC",  family: "us_bdc",  subSector: "diversified" },
  { symbol: "BXSL",  family: "us_bdc",  subSector: "diversified" },
  { symbol: "FSK",   family: "us_bdc",  subSector: "diversified" },
  { symbol: "PSEC",  family: "us_bdc",  subSector: "diversified" },

  // UK REITs — diverse across sub-sectors
  { symbol: "BLND.L", family: "uk_reit", subSector: "diversified" },
  { symbol: "LAND.L", family: "uk_reit", subSector: "diversified" },
  { symbol: "SGRO.L", family: "uk_reit", subSector: "industrial" },
  { symbol: "UTG.L",  family: "uk_reit", subSector: "student" }, // The Unite Group plc
  { symbol: "BBOX.L", family: "uk_reit", subSector: "industrial" },
  { symbol: "PHP.L",  family: "uk_reit", subSector: "healthcare" },
  { symbol: "DLN.L",  family: "uk_reit", subSector: "office" },
  { symbol: "GPE.L",  family: "uk_reit", subSector: "office" },
];

// ----- Endpoint catalogue ------------------------------------------------
//
// `criticalFor` lists the families for which this endpoint is needed to
// compute at least one signal in the Phase 4 spec. The gate is computed
// against the (family × criticalEndpoint) cell set, not all cells.

const ENDPOINTS = [
  {
    id: "profile",
    path: "profile",
    purpose: "sector classification + currency",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "dividends",
    path: "dividends",
    purpose: "Q_S1 streak, R_S1 cut, R_B2 special-vs-regular",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "historical-eod",
    path: "historical-price-eod/full",
    purpose: "D_S1 Price/NAV (price half)",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "ratios-ttm",
    path: "ratios-ttm",
    purpose: "payout ratio, interest cover, debt ratios",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "income-statement-a",
    path: "income-statement",
    extra: "&period=annual&limit=10",
    purpose: "revenue, interest expense, NII (BDC), FFO components (REIT)",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "income-statement-q",
    path: "income-statement",
    extra: "&period=quarter&limit=20",
    purpose: "quarterly cadence for US tickers (UK semi-annual)",
    criticalFor: ["us_reit", "us_bdc"],
  },
  {
    id: "balance-sheet-a",
    path: "balance-sheet-statement",
    extra: "&period=annual&limit=10",
    purpose: "debt, equity, NAV/share (all), property assets (UK LTV)",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "balance-sheet-q",
    path: "balance-sheet-statement",
    extra: "&period=quarter&limit=20",
    purpose: "quarterly NAV trend (US)",
    criticalFor: ["us_reit", "us_bdc"],
  },
  {
    id: "cash-flow-a",
    path: "cash-flow-statement",
    extra: "&period=annual&limit=10",
    purpose: "depreciation (FFO proxy for REITs)",
    criticalFor: ["us_reit", "uk_reit"],
  },
  {
    id: "key-metrics-ttm",
    path: "key-metrics-ttm",
    purpose: "ROE, debt/equity, book value per share",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "enterprise-values-a",
    path: "enterprise-values",
    extra: "&period=annual&limit=10",
    purpose: "net debt, market cap snapshots",
    criticalFor: ["us_reit", "us_bdc", "uk_reit"],
  },
  {
    id: "revenue-product-segmentation",
    path: "revenue-product-segmentation",
    extra: "&period=annual",
    purpose: "C_R1 / C_U1 property-type HHI",
    criticalFor: ["us_reit", "uk_reit"],
  },
  {
    id: "revenue-geographic-segmentation",
    path: "revenue-geographic-segmentation",
    extra: "&period=annual",
    purpose: "C_R2 / C_U2 geographic HHI",
    criticalFor: ["us_reit", "uk_reit"],
  },
];

// ----- Response classification ------------------------------------------

const BLOCKED_PATTERNS = [
  /Premium Query Parameter/i,
  /Forbidden/i,
  /Limit Reach/i,
  /requires.+subscription/i,
];

export function classifyFmpResponse(status, body) {
  if (status >= 400) return "error";
  if (body == null) return "empty";
  if (Array.isArray(body) && body.length === 0) return "empty";

  const errMsg =
    (body && typeof body === "object" && (body["Error Message"] || body.error)) || "";
  if (typeof errMsg === "string" && errMsg) {
    if (BLOCKED_PATTERNS.some((p) => p.test(errMsg))) return "blocked";
    return "error";
  }
  return "full";
}

async function fetchEndpoint(endpoint, ticker, apiKey) {
  const url = `${FMP_BASE}/${endpoint.path}?symbol=${encodeURIComponent(ticker.symbol)}${endpoint.extra ?? ""}&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* leave null */ }
    return { status: res.status, classification: classifyFmpResponse(res.status, body), body };
  } catch (err) {
    return { status: 0, classification: "error", note: String(err.message ?? err) };
  }
}

// ----- Field-level spot checks ------------------------------------------
//
// One representative ticker per family. The signal-critical field check
// catches "endpoint responds but the line we need is null" failure modes.
// Cheaper than scanning every (ticker × endpoint) for field presence.

const FIELD_SPOTCHECKS = [
  { family: "us_reit", ticker: "O",     endpoint: "cash-flow-a",  field: "depreciationAndAmortization", reason: "FFO = NI + D&A − gains" },
  { family: "us_reit", ticker: "O",     endpoint: "income-statement-a", field: "interestExpense",       reason: "R_R1 interest cover" },
  { family: "us_bdc",  ticker: "ARCC",  endpoint: "income-statement-a", field: "interestIncome",         reason: "BDC NII proxy (investment income)" },
  { family: "us_bdc",  ticker: "ARCC",  endpoint: "balance-sheet-a",    field: "totalDebt",               reason: "C_B1 statutory leverage" },
  { family: "uk_reit", ticker: "BLND.L",endpoint: "balance-sheet-a",    field: "totalDebt",               reason: "Q_U2 LTV numerator" },
  { family: "uk_reit", ticker: "BLND.L",endpoint: "balance-sheet-a",    field: "propertyPlantEquipmentNet", reason: "LTV denominator proxy (FMP real estate field varies)" },
];

function spotCheckField(rows, check) {
  const row = rows.find((r) => r.ticker === check.ticker && r.endpoint === check.endpoint);
  if (!row || row.classification !== "full" || !Array.isArray(row.body) || row.body.length === 0) {
    return { ...check, present: false, value: null, reason: check.reason, note: "endpoint not full" };
  }
  const value = row.body[0]?.[check.field];
  const present = value !== undefined && value !== null && value !== 0;
  return { ...check, present, value, reason: check.reason };
}

// ----- Driver -----------------------------------------------------------

async function runMatrix() {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    console.error("FMP_API_KEY not set");
    process.exit(1);
  }

  const rows = [];
  for (const ticker of TICKERS) {
    for (const endpoint of ENDPOINTS) {
      const result = await fetchEndpoint(endpoint, ticker, apiKey);
      rows.push({
        ticker: ticker.symbol,
        family: ticker.family,
        endpoint: endpoint.id,
        status: result.status,
        classification: result.classification,
        body: result.body,
      });
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // ----- Per-family gates -----
  const families = ["us_reit", "us_bdc", "uk_reit"];
  const gates = {};
  for (const family of families) {
    const criticalEndpoints = ENDPOINTS.filter((e) => e.criticalFor.includes(family)).map((e) => e.id);
    const familyTickers = TICKERS.filter((t) => t.family === family).map((t) => t.symbol);
    const cells = rows.filter(
      (r) => familyTickers.includes(r.ticker) && criticalEndpoints.includes(r.endpoint),
    );
    const full = cells.filter((c) => c.classification === "full").length;
    const total = cells.length;
    const pct = total === 0 ? 0 : (full / total) * 100;
    gates[family] = {
      full,
      total,
      pct: Number(pct.toFixed(1)),
      pass: pct >= 80,
      criticalEndpointCount: criticalEndpoints.length,
      tickerCount: familyTickers.length,
    };
  }

  // ----- Field-level spot checks -----
  const spotResults = FIELD_SPOTCHECKS.map((c) => spotCheckField(rows, c));

  // ----- Markdown output -----
  const generatedAt = new Date().toISOString();
  let out = "";
  out += "# FMP Vehicle Coverage Matrix (Phase 4 pre-flight)\n\n";
  out += `_Generated ${generatedAt} via scripts/scoring/fmp-vehicle-coverage-matrix.js_\n\n`;
  out += "Probes the FMP `/stable/` endpoints needed to compute Phase 4 Resilience Score across US equity REITs, US BDCs, and UK REITs. See `planning/08-phase-4-income-vehicle-scoring.md` Open Question 1.\n\n";

  // Per-family gate summary up top
  out += "## Gate decision\n\n";
  out += "| Family | Critical cells | Full | % | Gate (≥80%) |\n|---|---|---|---|---|\n";
  for (const family of families) {
    const g = gates[family];
    const emoji = g.pass ? "✅ PASS" : "❌ FAIL";
    out += `| ${family} | ${g.total} | ${g.full} | ${g.pct}% | ${emoji} |\n`;
  }
  out += "\n";
  out += "- **All families PASS:** proceed to Sprint 1 Day 1 (universe lock + migration 0014).\n";
  out += "- **Any family FAIL:** escalate to Glenn. Options: drop the family from V1, shrink the universe to only well-covered tickers, or add a supplementary data source for that family before Sprint 1.\n\n";

  // Field-level spot checks
  out += "## Signal-critical field spot checks\n\n";
  out += "Endpoint coverage `full` does not guarantee that the specific field used by a signal is populated. Spot-checks below confirm one representative field per family.\n\n";
  out += "| Family | Ticker | Endpoint | Field | Present | Reason needed |\n|---|---|---|---|---|---|\n";
  for (const s of spotResults) {
    const presentEmoji = s.present ? "✅ yes" : "❌ no";
    out += `| ${s.family} | ${s.ticker} | ${s.endpoint} | \`${s.field}\` | ${presentEmoji} | ${s.reason} |\n`;
  }
  out += "\n";

  // Full coverage matrix per family
  for (const family of families) {
    const familyTickers = TICKERS.filter((t) => t.family === family);
    out += `## ${family} — full coverage matrix\n\n`;
    out += "| Endpoint | " + familyTickers.map((t) => t.symbol).join(" | ") + " |\n";
    out += "|---|" + familyTickers.map(() => "---").join("|") + "|\n";
    for (const ep of ENDPOINTS) {
      const isCritical = ep.criticalFor.includes(family);
      const label = isCritical ? `**${ep.id}**` : ep.id;
      const cells = familyTickers.map((t) => {
        const r = rows.find((x) => x.ticker === t.symbol && x.endpoint === ep.id);
        const emoji = r.classification === "full" ? "✅"
          : r.classification === "blocked" ? "🚫"
          : r.classification === "empty" ? "⚪"
          : "❌";
        return `${emoji}`;
      });
      out += `| ${label} | ${cells.join(" | ")} |\n`;
    }
    out += "\n_Endpoints in **bold** are critical for this family's signals; non-critical rows are shown for completeness._\n\n";
  }

  // Endpoint legend
  out += "## Endpoint legend\n\n";
  out += "| Endpoint | Purpose | Critical for |\n|---|---|---|\n";
  for (const ep of ENDPOINTS) {
    out += `| \`${ep.id}\` | ${ep.purpose} | ${ep.criticalFor.join(", ")} |\n`;
  }
  out += "\n";
  out += "Classification: ✅ full · ⚪ empty · 🚫 blocked (subscription gate) · ❌ error/HTTP-failure.\n";

  process.stdout.write(out);
}

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const invokedDirectly =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) {
  runMatrix().catch((e) => { console.error(e); process.exit(1); });
}

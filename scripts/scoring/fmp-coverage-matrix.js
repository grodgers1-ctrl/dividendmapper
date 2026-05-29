// Standalone Node 20+ script. Run from repo root:
//   set -a && source dividendmapper/.env.local && set +a
//   node scripts/scoring/fmp-coverage-matrix.js > planning/research/fmp-coverage-matrix.md
//
// Hits 16 FMP /stable/ endpoints for 10 representative tickers (4 US, 6 LSE),
// classifies each response, emits a markdown coverage table.

const FMP_BASE = "https://financialmodelingprep.com/stable";

const TICKERS = [
  { symbol: "AAPL", market: "NASDAQ" },
  { symbol: "MSFT", market: "NASDAQ" },
  { symbol: "SCHD", market: "NYSEARCA" },
  { symbol: "JEPI", market: "NYSEARCA" },
  { symbol: "ULVR.L", market: "LSE" },
  { symbol: "LGEN.L", market: "LSE" },
  { symbol: "VOD.L", market: "LSE" },
  { symbol: "IMB.L", market: "LSE" },
  { symbol: "BATS.L", market: "LSE" },
  { symbol: "GSK.L", market: "LSE" },
];

const ENDPOINTS = [
  { id: "ratios-ttm",                path: "ratios-ttm" },
  { id: "dividends",                 path: "dividends" },
  { id: "income-statement-q",        path: "income-statement", extra: "&period=quarter" },
  { id: "cash-flow-q",               path: "cash-flow-statement", extra: "&period=quarter" },
  { id: "balance-sheet-q",           path: "balance-sheet-statement", extra: "&period=quarter" },
  { id: "profile",                   path: "profile" },
  { id: "analyst-estimates",         path: "analyst-estimates", extra: "&period=annual" },
  { id: "discounted-cash-flow",      path: "discounted-cash-flow" },
  { id: "levered-dcf",               path: "levered-discounted-cash-flow" },
  { id: "sma-200",                   path: "technical-indicators/sma", extra: "&periodLength=200&timeframe=1day" },
  { id: "historical-eod",            path: "historical-price-eod/full" },
  { id: "rsi-14",                    path: "technical-indicators/rsi", extra: "&periodLength=14&timeframe=1day" },
  { id: "price-target-consensus",    path: "price-target-consensus" },
  { id: "grades",                    path: "grades" },
  { id: "insider-trading",           path: "insider-trading/search" },
  { id: "search",                    path: "search" },
];

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
  let url;
  if (endpoint.id === "search") {
    url = `${FMP_BASE}/${endpoint.path}?query=${encodeURIComponent(ticker.symbol.split(".")[0])}&apikey=${apiKey}`;
  } else {
    url = `${FMP_BASE}/${endpoint.path}?symbol=${encodeURIComponent(ticker.symbol)}${endpoint.extra ?? ""}&apikey=${apiKey}`;
  }
  try {
    const res = await fetch(url);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* leave null */ }
    return { status: res.status, classification: classifyFmpResponse(res.status, body) };
  } catch (err) {
    return { status: 0, classification: "error", note: String(err.message ?? err) };
  }
}

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
      rows.push({ ticker: ticker.symbol, market: ticker.market, endpoint: endpoint.id, ...result });
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  const header = "# FMP Coverage Matrix\n\n" +
    `_Generated ${new Date().toISOString()} via scripts/scoring/fmp-coverage-matrix.js_\n\n`;
  const tickerHeader = "| Endpoint | " + TICKERS.map((t) => t.symbol).join(" | ") + " |\n";
  const sep = "|---|" + TICKERS.map(() => "---").join("|") + "|\n";

  const endpointLines = ENDPOINTS.map((ep) => {
    const cells = TICKERS.map((t) => {
      const r = rows.find((x) => x.ticker === t.symbol && x.endpoint === ep.id);
      const emoji = r.classification === "full" ? "✅"
        : r.classification === "blocked" ? "🚫"
        : r.classification === "empty" ? "⚪"
        : "❌";
      return `${emoji} ${r.classification}`;
    });
    return `| ${ep.id} | ${cells.join(" | ")} |`;
  }).join("\n");

  const lseCells = rows.filter((r) => r.market === "LSE");
  const lseFull = lseCells.filter((r) => r.classification === "full").length;
  const lseTotal = lseCells.length;
  const lsePct = ((lseFull / lseTotal) * 100).toFixed(1);

  const usCells = rows.filter((r) => r.market !== "LSE");
  const usFull = usCells.filter((r) => r.classification === "full").length;
  const usTotal = usCells.length;
  const usPct = ((usFull / usTotal) * 100).toFixed(1);

  const gate = Number(lsePct) >= 60 ? "✅ PASS" : "❌ FAIL";

  const summary = `\n\n## Gate decision\n\n` +
    `- LSE coverage: **${lseFull}/${lseTotal} cells (${lsePct}%)** — gate threshold 60% → ${gate}\n` +
    `- US coverage: ${usFull}/${usTotal} cells (${usPct}%)\n\n` +
    `**If LSE PASS:** proceed to Day 1 afternoon (schema + cron + FMP client).\n` +
    `**If LSE FAIL:** STOP. Escalate to Glenn. Options: ship US-only, accept degradation matrix, or abort FMP swap and keep EODHD.\n`;

  process.stdout.write(header + tickerHeader + sep + endpointLines + summary);
}

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const invokedDirectly =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) {
  runMatrix().catch((e) => { console.error(e); process.exit(1); });
}

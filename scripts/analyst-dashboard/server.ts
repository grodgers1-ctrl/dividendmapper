// Local Express server for the analyst dashboard. Loads the .backtest-cache
// once at startup, then serves the SPA + 3 JSON endpoints. No persistence, no
// auth, no live FMP — purely an analyst what-if surface.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { loadAllCache, cacheMtime, type CacheBundle } from "./cache-loader.js";
import { prepareInputs } from "./local-assemble.js";
import {
  computeBuyScore,
  computeTrimScore,
  computeRiskScore,
  compositeSignal,
  type Weights,
} from "./local-orchestrator.js";
import { allocateReinvest } from "./reinvest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5000);

interface ScoreRow {
  ticker: string;
  companyName: string;
  sector: string;
  buy: number | null;
  trim: number | null;
  risk: number;
  signal: string;
  failedGates: string[];
}

let cache: Map<string, CacheBundle>;
let mtime: Date;
let defaultWeights: Weights;

function scoreAll(weights: Weights, asOf: Date = new Date()): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const [ticker, bundle] of cache) {
    try {
      const inputs = prepareInputs(bundle, asOf);
      const buy = computeBuyScore(inputs.buy, weights.buy);
      const trim = computeTrimScore(inputs.trim, weights.trim);
      const risk = computeRiskScore(inputs.risk);
      rows.push({
        ticker,
        companyName: inputs.meta.companyName,
        sector: inputs.meta.sector,
        buy: buy.score,
        trim: trim.score,
        risk: risk.score,
        signal: compositeSignal(buy.score, trim.score, risk.score),
        failedGates: buy.failedGates,
      });
    } catch (err) {
      console.error(`[score] ${ticker}: ${(err as Error).message}`);
      rows.push({
        ticker,
        companyName: ticker,
        sector: "other",
        buy: null,
        trim: null,
        risk: 0,
        signal: "Hold",
        failedGates: [],
      });
    }
  }
  return rows;
}

async function main() {
  console.log("[analyst] loading .backtest-cache …");
  cache = await loadAllCache();
  mtime = await cacheMtime();
  const configPath = path.join(__dirname, "config.json");
  defaultWeights = JSON.parse(await fs.readFile(configPath, "utf8")) as Weights;
  console.log(`[analyst] ${cache.size} tickers loaded, cache mtime ${mtime.toISOString()}`);

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/tickers", (_req, res) => {
    res.json({
      count: cache.size,
      tickers: [...cache.keys()].sort(),
      mtime: mtime.toISOString(),
      defaultWeights,
    });
  });

  app.post("/api/score", (req, res) => {
    const weights = (req.body?.weights ?? defaultWeights) as Weights;
    const rows = scoreAll(weights);
    res.json({ rows });
  });

  app.get("/api/reinvest", (req, res) => {
    const cash = Number(req.query.cash ?? 0);
    const rows = scoreAll(defaultWeights);
    const alloc = allocateReinvest(cash, rows.map((r) => ({ ticker: r.ticker, buy: r.buy })));
    res.json({ cash, allocations: alloc });
  });

  app.listen(PORT, () => {
    console.log(`[analyst] listening at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Reads .backtest-cache/<TICKER>/ into a typed CacheBundle. Each subdir holds
// up to 8 FMP JSON files; missing files become empty arrays so the orchestrator
// can fall back to N/A for any signal that needs them.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_ROOT = path.resolve(__dirname, "..", "..", ".backtest-cache");

// Skip non-ticker entries in the cache root.
const SKIP_DIRS = new Set(["sectors", "fx"]);

export interface CacheBundle {
  ticker: string;
  profile: Record<string, unknown>[];
  dividends: Record<string, unknown>[];
  historicalEod: Record<string, unknown>[];
  incomeQuarterly: Record<string, unknown>[];
  cashflowQuarterly: Record<string, unknown>[];
  balanceQuarterly: Record<string, unknown>[];
  grades: Record<string, unknown>[];
  insiderTrades: Record<string, unknown>[];
}

const FILE_TO_FIELD: Array<[string, keyof CacheBundle]> = [
  ["profile.json", "profile"],
  ["dividends.json", "dividends"],
  ["historical-price-eod.json", "historicalEod"],
  ["income-statement-quarter.json", "incomeQuarterly"],
  ["cash-flow-statement-quarter.json", "cashflowQuarterly"],
  ["balance-sheet-quarter.json", "balanceQuarterly"],
  ["grades.json", "grades"],
  ["insider-trading.json", "insiderTrades"],
];

async function readJsonArray(file: string): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadOneTicker(ticker: string): Promise<CacheBundle> {
  const dir = path.join(CACHE_ROOT, ticker);
  const bundle: CacheBundle = {
    ticker,
    profile: [],
    dividends: [],
    historicalEod: [],
    incomeQuarterly: [],
    cashflowQuarterly: [],
    balanceQuarterly: [],
    grades: [],
    insiderTrades: [],
  };
  await Promise.all(
    FILE_TO_FIELD.map(async ([fname, field]) => {
      const arr = await readJsonArray(path.join(dir, fname));
      (bundle[field] as Record<string, unknown>[]) = arr;
    }),
  );
  return bundle;
}

export async function loadAllCache(): Promise<Map<string, CacheBundle>> {
  let entries: string[];
  try {
    entries = await fs.readdir(CACHE_ROOT);
  } catch {
    throw new Error(
      `Cache not found at ${CACHE_ROOT}. Run scripts/backtest first to populate it.`,
    );
  }
  const tickers: string[] = [];
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const stat = await fs.stat(path.join(CACHE_ROOT, name));
    if (stat.isDirectory()) tickers.push(name);
  }
  const bundles = await Promise.all(tickers.map(loadOneTicker));
  return new Map(bundles.map((b) => [b.ticker, b]));
}

export async function cacheMtime(): Promise<Date> {
  try {
    const stat = await fs.stat(CACHE_ROOT);
    return stat.mtime;
  } catch {
    return new Date(0);
  }
}

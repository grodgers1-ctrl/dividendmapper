import { resolve } from "path";

// Cache + outputs live at the MONOREPO ROOT (one level above dividendmapper/)
// so they cannot pollute the Next.js build root or be Vercel-bundled.
const MONOREPO_ROOT = resolve(__dirname, "../../..");

export const DEFAULT_CACHE_ROOT = resolve(MONOREPO_ROOT, ".backtest-cache");
export const OUTPUT_ROOT = resolve(MONOREPO_ROOT, "backtest-out");

// All path builders take cacheRoot explicitly. Production code passes
// DEFAULT_CACHE_ROOT; tests pass a tmpdir. No global state at runtime.
export function tickerCachePath(cacheRoot: string, ticker: string, endpoint: string): string {
  return resolve(cacheRoot, ticker, `${endpoint}.json`);
}

export function sectorPeerCachePath(cacheRoot: string, sector: string, ticker: string, endpoint: string): string {
  return resolve(cacheRoot, "sectors", sector, ticker, `${endpoint}.json`);
}

export function fxCachePath(cacheRoot: string): string {
  return resolve(cacheRoot, "fx", "usd-gbp.json");
}

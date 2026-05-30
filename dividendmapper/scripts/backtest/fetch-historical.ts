import { resolve } from "path";
import { writeCacheAtomic, cacheExists } from "./cache";
import { fetchTickerEndpoints, type EndpointSpec } from "./fmp-fetcher";

export const TICKER_ENDPOINTS: EndpointSpec[] = [
  { name: "profile", url: "/stable/profile?symbol={SYMBOL}" },
  { name: "historical-price-eod", url: "/stable/historical-price-eod/full?symbol={SYMBOL}" },
  { name: "dividends", url: "/stable/dividends?symbol={SYMBOL}" },
  { name: "sma-200", url: "/stable/technical-indicators/sma?symbol={SYMBOL}&periodLength=200&timeframe=1day" },
  { name: "rsi-14", url: "/stable/technical-indicators/rsi?symbol={SYMBOL}&periodLength=14&timeframe=1day" },
  { name: "income-statement-quarter", url: "/stable/income-statement?symbol={SYMBOL}&period=quarter" },
  { name: "cash-flow-statement-quarter", url: "/stable/cash-flow-statement?symbol={SYMBOL}&period=quarter" },
  { name: "balance-sheet-quarter", url: "/stable/balance-sheet-statement?symbol={SYMBOL}&period=quarter" },
  { name: "grades", url: "/stable/grades?symbol={SYMBOL}" },
  { name: "insider-trading", url: "/stable/insider-trading/search?symbol={SYMBOL}" },
];

export interface SeedArgs {
  ticker: string;
  cacheRoot: string;
  httpGet: (url: string) => Promise<unknown>;
  padMs: number;
  force?: boolean;
}

export async function seedTickerCache(args: SeedArgs): Promise<void> {
  const { ticker, cacheRoot, httpGet, padMs, force = false } = args;

  const todo: EndpointSpec[] = TICKER_ENDPOINTS
    .map((ep) => ({ ...ep, url: ep.url.replace("{SYMBOL}", encodeURIComponent(ticker)) }))
    .filter((ep) => force || !cacheExists(resolve(cacheRoot, ticker, `${ep.name}.json`)));

  if (todo.length === 0) return;

  const results = await fetchTickerEndpoints({ ticker, endpoints: todo, httpGet, padMs });
  for (const [name, value] of Object.entries(results)) {
    writeCacheAtomic(resolve(cacheRoot, ticker, `${name}.json`), value);
  }
}

export const PEER_ENDPOINTS: EndpointSpec[] = [
  { name: "profile", url: "/stable/profile?symbol={SYMBOL}" },
  { name: "historical-price-eod", url: "/stable/historical-price-eod/full?symbol={SYMBOL}" },
  { name: "dividends", url: "/stable/dividends?symbol={SYMBOL}" },
];

export interface SeedPeerArgs {
  sector: string;
  ticker: string;
  cacheRoot: string;
  httpGet: (url: string) => Promise<unknown>;
  padMs: number;
  force?: boolean;
}

export async function seedPeerCache(args: SeedPeerArgs): Promise<void> {
  const { sector, ticker, cacheRoot, httpGet, padMs, force = false } = args;
  const peerDir = `sectors/${sector}/${ticker}`;

  const todo: EndpointSpec[] = PEER_ENDPOINTS
    .map((ep) => ({ ...ep, url: ep.url.replace("{SYMBOL}", encodeURIComponent(ticker)) }))
    .filter((ep) => force || !cacheExists(resolve(cacheRoot, peerDir, `${ep.name}.json`)));

  if (todo.length === 0) return;

  const results = await fetchTickerEndpoints({ ticker, endpoints: todo, httpGet, padMs });
  for (const [name, value] of Object.entries(results)) {
    writeCacheAtomic(resolve(cacheRoot, peerDir, `${name}.json`), value);
  }
}

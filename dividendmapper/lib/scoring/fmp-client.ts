// Typed wrapper around the FMP /stable/ API. Day 1 surface is intentionally
// thin (getProfile only) — additional endpoint methods land in Day 2-5 as
// signal modules need them. The generic fetchEndpoint() is exported so signal
// authors can hit any /stable/ path with the same cache + retry + error
// classification.
//
// Reads FMP_API_KEY from process.env. Throws typed errors so callers can
// translate them into per-signal N/A behaviour:
//   - FmpConfigError      — missing API key (server misconfigured)
//   - FmpAccessError      — 200 + Premium Query Parameter / Forbidden body
//   - FmpRateLimitError   — exhausted 5 retries on 429
//   - FmpHttpError        — terminal 4xx/5xx (not 429)
//
// Cache: per-(path,paramsKey) Map with TTL. Default 24h for fundamentals; the
// nightly cron runs once per day so this collapses duplicate fetches within a
// single run (e.g. SMA + RSI both pulling historical price). Memory is per
// Vercel function instance and resets on cold start — fine for our load.
// Failed responses are NOT cached.

import * as Sentry from "@sentry/nextjs";

export class FmpConfigError extends Error {
  constructor() {
    super("FMP_API_KEY not set");
    this.name = "FmpConfigError";
  }
}
export class FmpAccessError extends Error {
  constructor(public path: string, public bodyMessage: string) {
    super(`FMP access denied for ${path}: ${bodyMessage}`);
    this.name = "FmpAccessError";
  }
}
export class FmpRateLimitError extends Error {
  constructor(public path: string) {
    super(`FMP rate-limited (5 retries exhausted) for ${path}`);
    this.name = "FmpRateLimitError";
  }
}
export class FmpHttpError extends Error {
  constructor(
    public path: string,
    public status: number,
    public body: string,
  ) {
    super(`FMP ${path} returned ${status}`);
    this.name = "FmpHttpError";
  }
}

const FMP_BASE = "https://financialmodelingprep.com/stable";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 5;
// In test runs (vitest sets NODE_ENV=test) we collapse the exponential backoff
// to zero so retry-loop tests don't burn wall time. Production stays at 1s base.
const BACKOFF_BASE_MS = process.env.NODE_ENV === "test" ? 0 : 1000;

const BLOCKED_PATTERNS = [
  /Premium Query Parameter/i,
  /Forbidden/i,
  /Limit Reach/i,
  /requires.+subscription/i,
];

interface CacheEntry {
  body: unknown;
  expires: number;
}
const cache = new Map<string, CacheEntry>();

// Exported only for tests to spy on. Production code never imports this.
export function __sleepForTest(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new FmpConfigError();
  return key;
}

function buildCacheKey(path: string, params: Record<string, string>): string {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return `${path}?${sorted.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export interface FetchEndpointOptions {
  ttlMs?: number;
}

export async function fetchEndpoint(
  path: string,
  params: Record<string, string>,
  options: FetchEndpointOptions = {},
): Promise<unknown> {
  const apiKey = getApiKey();
  const cacheKey = buildCacheKey(path, params);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.body;
  }

  const url = `${FMP_BASE}/${path}?${new URLSearchParams({ ...params, apikey: apiKey }).toString()}`;

  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    lastStatus = res.status;
    lastBody = await res.text();

    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        await __sleepForTest(BACKOFF_BASE_MS * Math.pow(2, attempt - 1));
        continue;
      }
      const err = new FmpRateLimitError(path);
      Sentry.captureException(err, { extra: { url, attempt } });
      throw err;
    }

    if (res.status >= 400) {
      const err = new FmpHttpError(path, res.status, lastBody);
      Sentry.captureException(err, { extra: { url } });
      throw err;
    }

    let parsed: unknown = null;
    try {
      parsed = lastBody ? JSON.parse(lastBody) : null;
    } catch {
      // leave as null
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const msg = (obj["Error Message"] ?? obj.error ?? "") as string;
      if (
        typeof msg === "string" &&
        msg &&
        BLOCKED_PATTERNS.some((p) => p.test(msg))
      ) {
        const err = new FmpAccessError(path, msg);
        Sentry.captureException(err, { extra: { url } });
        throw err;
      }
    }

    const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
    cache.set(cacheKey, { body: parsed, expires: Date.now() + ttl });
    return parsed;
  }

  throw new FmpHttpError(path, lastStatus, lastBody);
}

export interface FmpProfile {
  symbol: string;
  companyName?: string | null;
  price?: number | null;
  lastDividend?: number | null;
  mktCap: number;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  exchange: string | null;
  isEtf?: boolean;
  isFund?: boolean;
}

export async function getProfile(symbol: string): Promise<FmpProfile[]> {
  return (await fetchEndpoint("profile", { symbol })) as FmpProfile[];
}

export interface FmpSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  exchangeFullName: string;
  currency: string;
}

export async function searchSymbol(query: string, limit = 8): Promise<FmpSearchResult[]> {
  return (await fetchEndpoint("search-symbol", {
    query,
    limit: String(limit),
  })) as FmpSearchResult[];
}

export async function searchByName(query: string, limit = 8): Promise<FmpSearchResult[]> {
  return (await fetchEndpoint("search-name", {
    query,
    limit: String(limit),
  })) as FmpSearchResult[];
}

// Exchange rank: lower number = higher rank. Surfaces major listings before
// OTC fragments so users with "legal" land on LGEN.L not LGGNF.
const EXCHANGE_RANK: Record<string, number> = {
  LSE: 1,
  NASDAQ: 2,
  NYSE: 2,
  NYSEARCA: 2,
  AMEX: 3,
  TSX: 4,
  TSXV: 5,
  OTC: 9,
  PNK: 9,
};

export function rankSearchResults(query: string, results: FmpSearchResult[]): FmpSearchResult[] {
  const upperQ = query.toUpperCase();
  function exactnessTier(symbol: string): number {
    const upS = symbol.toUpperCase();
    if (upS === upperQ) return 0;                              // exact full match (e.g. "AAPL" -> "AAPL")
    if (upS.split(".")[0] === upperQ) return 1;                // exact prefix match (e.g. "AAPL" -> "AAPL.L")
    return 2;                                                  // partial / name match
  }
  return [...results].sort((a, b) => {
    const aTier = exactnessTier(a.symbol);
    const bTier = exactnessTier(b.symbol);
    if (aTier !== bTier) return aTier - bTier;

    const aRank = EXCHANGE_RANK[a.exchange?.toUpperCase()] ?? 7;
    const bRank = EXCHANGE_RANK[b.exchange?.toUpperCase()] ?? 7;
    if (aRank !== bRank) return aRank - bRank;

    return a.symbol.localeCompare(b.symbol);
  });
}

// ---------------------------------------------------------------------------
// Day 5 — scoring data endpoints. Thin wrappers around fetchEndpoint(); paths +
// params verified against the live /stable/ API on 2026-05-29. Return types are
// kept loose (Record<string, unknown>[]) where the downstream consumer
// (assemble-inputs) reads fields defensively; tighter shapes are declared only
// where the probe confirmed exact field names.
// ---------------------------------------------------------------------------

type FmpRow = Record<string, unknown>;

export interface FmpRatiosTtm {
  symbol: string;
  dividendPayoutRatioTTM?: number;
  dividendYieldTTM?: number;
  [k: string]: unknown;
}
export async function getRatiosTtm(symbol: string): Promise<FmpRatiosTtm[]> {
  return (await fetchEndpoint("ratios-ttm", { symbol })) as FmpRatiosTtm[];
}

// Historical quarterly ratios — used for the A2 P/E history series
// (priceToEarningsRatio) and R6 (interestCoverageRatio).
export async function getRatiosQuarterly(symbol: string, limit = 40): Promise<FmpRow[]> {
  return (await fetchEndpoint("ratios", {
    symbol,
    period: "quarter",
    limit: String(limit),
  })) as FmpRow[];
}

export interface FmpDividend {
  date: string;
  adjDividend: number;
  dividend: number;
  [k: string]: unknown;
}
export async function getDividends(symbol: string, limit = 8): Promise<FmpDividend[]> {
  return (await fetchEndpoint("dividends", { symbol, limit: String(limit) })) as FmpDividend[];
}

export async function getIncomeStatementQuarterly(symbol: string, limit = 40): Promise<FmpRow[]> {
  return (await fetchEndpoint("income-statement", {
    symbol,
    period: "quarter",
    limit: String(limit),
  })) as FmpRow[];
}

export async function getCashFlowStatementQuarterly(symbol: string, limit = 40): Promise<FmpRow[]> {
  return (await fetchEndpoint("cash-flow-statement", {
    symbol,
    period: "quarter",
    limit: String(limit),
  })) as FmpRow[];
}

export async function getBalanceSheetStatementQuarterly(symbol: string, limit = 8): Promise<FmpRow[]> {
  return (await fetchEndpoint("balance-sheet-statement", {
    symbol,
    period: "quarter",
    limit: String(limit),
  })) as FmpRow[];
}

export async function getKeyMetricsTtm(symbol: string): Promise<FmpRow[]> {
  return (await fetchEndpoint("key-metrics-ttm", { symbol })) as FmpRow[];
}

export async function getKeyMetricsQuarterly(symbol: string, limit = 40): Promise<FmpRow[]> {
  return (await fetchEndpoint("key-metrics", {
    symbol,
    period: "quarter",
    limit: String(limit),
  })) as FmpRow[];
}

export async function getAnalystEstimates(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit = 4,
): Promise<FmpRow[]> {
  return (await fetchEndpoint("analyst-estimates", {
    symbol,
    period,
    limit: String(limit),
  })) as FmpRow[];
}

export interface FmpDcf {
  symbol: string;
  dcf: number;
  "Stock Price": number;
  [k: string]: unknown;
}
export async function getDcf(symbol: string): Promise<FmpDcf[]> {
  return (await fetchEndpoint("discounted-cash-flow", { symbol })) as FmpDcf[];
}

export interface FmpIndicatorBar {
  date: string;
  close: number;
  high: number;
  low: number;
  sma?: number;
  rsi?: number;
  [k: string]: unknown;
}
export async function getSma(
  symbol: string,
  periodLength = 200,
  timeframe = "1day",
): Promise<FmpIndicatorBar[]> {
  return (await fetchEndpoint("technical-indicators/sma", {
    symbol,
    periodLength: String(periodLength),
    timeframe,
  })) as FmpIndicatorBar[];
}

export async function getRsi(
  symbol: string,
  periodLength = 14,
  timeframe = "1day",
): Promise<FmpIndicatorBar[]> {
  return (await fetchEndpoint("technical-indicators/rsi", {
    symbol,
    periodLength: String(periodLength),
    timeframe,
  })) as FmpIndicatorBar[];
}

export interface FmpEodBar {
  symbol: string;
  date: string;
  close: number;
  high: number;
  low: number;
  [k: string]: unknown;
}
export async function getHistoricalEod(symbol: string, from: string, to: string): Promise<FmpEodBar[]> {
  return (await fetchEndpoint("historical-price-eod/full", { symbol, from, to })) as FmpEodBar[];
}

export interface FmpPriceTarget {
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetConsensus: number;
  targetMedian: number;
}
export async function getPriceTargetConsensus(symbol: string): Promise<FmpPriceTarget[]> {
  return (await fetchEndpoint("price-target-consensus", { symbol })) as FmpPriceTarget[];
}

// grades-historical returns MONTHLY snapshots of analyst rating COUNTS
// (not individual upgrade/downgrade events). assemble-inputs diffs consecutive
// snapshots to derive net upgrades/downgrades for C2.
export interface FmpGradeSnapshot {
  symbol: string;
  date: string;
  analystRatingsStrongBuy: number;
  analystRatingsBuy: number;
  analystRatingsHold: number;
  analystRatingsSell: number;
  analystRatingsStrongSell: number;
}
export async function getGradesHistorical(symbol: string, limit = 12): Promise<FmpGradeSnapshot[]> {
  return (await fetchEndpoint("grades-historical", { symbol, limit: String(limit) })) as FmpGradeSnapshot[];
}

export interface FmpInsiderTrade {
  symbol: string;
  transactionType: string;
  securitiesTransacted: number;
  price: number;
  transactionDate: string;
  [k: string]: unknown;
}
export async function getInsiderTrades(symbol: string, limit = 100): Promise<FmpInsiderTrade[]> {
  return (await fetchEndpoint("insider-trading/search", {
    symbol,
    page: "0",
    limit: String(limit),
  })) as FmpInsiderTrade[];
}

// Market-wide upcoming dividends for a date range; assemble-inputs indexes by
// symbol to find each holding's next ex-dividend (D2). One call serves all
// tickers in a cron run.
export interface FmpCalendarDividend {
  symbol: string;
  date: string;          // ex-dividend date (YYYY-MM-DD)
  adjDividend: number;
  dividend: number;      // per share, native units
  paymentDate?: string;  // YYYY-MM-DD; "" or absent when FMP has not set it
  [k: string]: unknown;
}
export async function getDividendsCalendar(from: string, to: string): Promise<FmpCalendarDividend[]> {
  return (await fetchEndpoint("dividends-calendar", { from, to })) as FmpCalendarDividend[];
}

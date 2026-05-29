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
  mktCap: number;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  exchange: string | null;
}

export async function getProfile(symbol: string): Promise<FmpProfile[]> {
  return (await fetchEndpoint("profile", { symbol })) as FmpProfile[];
}

// Market quote fetcher — shared between /api/market/quote (DCF "Fetch" button)
// and lib/portfolio/income.ts (per-wrapper income roll-up).
//
//   fetchQuote("SCHD")    → Polygon (US)
//   fetchQuote("ULVR.L")  → EODHD (UK / LSE)
//
// 15-minute in-memory cache per ticker. Memory is per Vercel function
// instance and resets on cold start; that's fine for current traffic.
//
// Best-effort: any field the upstream API can't supply comes back as null.
// Callers must handle null prices / null dividends — failures should never
// block a UI render.

export interface QuoteData {
  ticker: string;
  source: "EODHD" | "Polygon";
  /** Last close, in the security's listed currency. */
  price: number | null;
  /** Annual dividend per share (forward where available, else TTM). */
  dividend: number | null;
  /** Trailing dividend yield = dividend / price. */
  dividendYield: number | null;
  /**
   * 3-year dividend CAGR (decimal). Compares last-12mo dividend total to the
   * 12mo total exactly 3 years earlier. null if either window is empty or the
   * result is wildly out of range (treated as a data quirk, not real growth).
   */
  dividendGrowth3yr: number | null;
  /** Listed currency, ISO code (e.g. "GBP", "USD", "GBX" for pence). */
  currency: string | null;
  exchange: string | null;
  /** Plain-English company name when the upstream API supplies it. */
  name: string | null;
  fetchedAt: string;
}

export type QuoteResult =
  | { ok: true; data: QuoteData; cached: boolean }
  | { ok: false; error: string; status: number };

export const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

interface CacheEntry {
  data: QuoteData;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
// Belt-and-braces: hard-cap the cache so a misbehaving client can't OOM the
// function instance by spraying random tickers at it.
const MAX_CACHE_ENTRIES = 500;

export class QuoteError extends Error {
  constructor(
    public code: string,
    public status?: number,
  ) {
    super(code);
  }
}

export function normaliseTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidTicker(ticker: string): boolean {
  return TICKER_RE.test(ticker);
}

/**
 * Fetch a quote, returning a QuoteResult discriminated union. Cache-aware.
 * Never throws — all upstream failures are normalised into `{ ok: false }`.
 */
export async function fetchQuote(rawTicker: string): Promise<QuoteResult> {
  const ticker = normaliseTicker(rawTicker);
  if (!ticker || !isValidTicker(ticker)) {
    return { ok: false, error: "invalid_ticker", status: 400 };
  }

  const cached = cache.get(ticker);
  if (cached && cached.expires > Date.now()) {
    return { ok: true, data: cached.data, cached: true };
  }

  const isUk = ticker.endsWith(".L") || ticker.endsWith(".LON");
  try {
    const data = isUk ? await fetchEodhd(ticker) : await fetchPolygon(ticker);
    putInCache(ticker, data);
    return { ok: true, data, cached: false };
  } catch (err) {
    console.error("[market/quote]", ticker, err);
    const code = err instanceof QuoteError ? err.code : "fetch_failed";
    const status = err instanceof QuoteError && err.status ? err.status : 502;
    return { ok: false, error: code, status };
  }
}

function putInCache(ticker: string, data: QuoteData): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Drop the oldest entry — Map iteration is insertion order.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ticker, { data, expires: Date.now() + CACHE_TTL_MS });
}

/* ─────────────────────────────────── EODHD (UK / LSE) */

async function fetchEodhd(ticker: string): Promise<QuoteData> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new QuoteError("eodhd_unconfigured", 503);

  // EODHD wants e.g. ULVR.L — already in this format. Strip ".LON" alias.
  const symbol = ticker.replace(/\.LON$/, ".L");

  // Fetch quote, fundamentals (forward dividend, name, currency), and 5 years
  // of dividend history (for the 3-year CAGR) in parallel.
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 5);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const [quoteRes, fundRes, divRes] = await Promise.all([
    fetch(
      `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json`,
      { cache: "no-store" },
    ),
    fetch(
      `https://eodhd.com/api/fundamentals/${encodeURIComponent(symbol)}?api_token=${apiKey}`,
      { cache: "no-store" },
    ),
    fetch(
      `https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${fromStr}`,
      { cache: "no-store" },
    ),
  ]);

  if (!quoteRes.ok) {
    if (quoteRes.status === 404) throw new QuoteError("ticker_not_found", 404);
    throw new QuoteError(`eodhd_quote_${quoteRes.status}`);
  }
  const quote: unknown = await quoteRes.json();
  const price =
    pickNumber(read(quote, ["close"])) ??
    pickNumber(read(quote, ["previousClose"]));

  let dividend: number | null = null;
  let currency: string | null = null;
  let exchange: string | null = null;
  let name: string | null = null;

  if (fundRes.ok) {
    try {
      const fund: unknown = await fundRes.json();
      dividend =
        pickNumber(
          read(fund, ["SplitsDividends", "ForwardAnnualDividendRate"]),
        ) ??
        pickNumber(read(fund, ["Highlights", "DividendShare"])) ??
        null;
      currency = pickString(read(fund, ["General", "CurrencyCode"]));
      exchange = pickString(read(fund, ["General", "Exchange"]));
      name = pickString(read(fund, ["General", "Name"]));
    } catch {
      // Fundamentals are a best-effort enrichment — fall through with nulls.
    }
  }

  let dividendGrowth3yr: number | null = null;
  if (divRes.ok) {
    try {
      const divList: unknown = await divRes.json();
      dividendGrowth3yr = compute3yrCagrFromEodhd(divList);
    } catch {
      // History is best-effort — leave growth null and let the user type it.
    }
  }

  // EODHD reports LSE prices in pence (GBX) by default. Convert to GBP so the
  // calculator's currency symbol matches the dividend.
  const adjustedPrice =
    currency === "GBX" && price !== null ? price / 100 : price;
  const adjustedCurrency = currency === "GBX" ? "GBP" : (currency ?? "GBP");

  const dividendYield =
    adjustedPrice && adjustedPrice > 0 && dividend && dividend > 0
      ? dividend / adjustedPrice
      : null;

  return {
    ticker,
    source: "EODHD",
    price: adjustedPrice,
    dividend,
    dividendYield,
    dividendGrowth3yr,
    currency: adjustedCurrency,
    exchange,
    name,
    fetchedAt: new Date().toISOString(),
  };
}

function compute3yrCagrFromEodhd(divList: unknown): number | null {
  if (!Array.isArray(divList) || divList.length === 0) return null;
  const events: DividendEvent[] = [];
  for (const ev of divList) {
    if (typeof ev !== "object" || ev === null) continue;
    const obj = ev as Record<string, unknown>;
    const dateStr = pickString(obj.date) ?? pickString(obj.paymentDate);
    const amt = pickNumber(obj.value) ?? pickNumber(obj.unadjustedValue);
    if (!dateStr || amt === null) continue;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) continue;
    events.push({ date, amount: amt });
  }
  return compute3yrCagr(events);
}

/* ─────────────────────────────────── Polygon (US) */

async function fetchPolygon(ticker: string): Promise<QuoteData> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new QuoteError("polygon_unconfigured", 503);

  const [snapshotRes, dividendsRes, refRes] = await Promise.all([
    fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`,
      { cache: "no-store" },
    ),
    // 30 events ≈ 7+ years for a quarterly payer — comfortably covers the
    // 36–48mo lookback window the CAGR calc needs.
    fetch(
      `https://api.polygon.io/v3/reference/dividends?ticker=${encodeURIComponent(ticker)}&order=desc&limit=30&apiKey=${apiKey}`,
      { cache: "no-store" },
    ),
    fetch(
      `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${apiKey}`,
      { cache: "no-store" },
    ),
  ]);

  if (!snapshotRes.ok) {
    if (snapshotRes.status === 404)
      throw new QuoteError("ticker_not_found", 404);
    throw new QuoteError(`polygon_snapshot_${snapshotRes.status}`);
  }

  const snapshot: unknown = await snapshotRes.json();
  const price = pickNumber(read(snapshot, ["results", 0, "c"]));

  let dividend: number | null = null;
  let dividendGrowth3yr: number | null = null;
  if (dividendsRes.ok) {
    try {
      const dividendsData: unknown = await dividendsRes.json();
      const events = parsePolygonDividends(read(dividendsData, ["results"]));
      dividend = sumLast12Months(events);
      dividendGrowth3yr = compute3yrCagr(events);
    } catch {
      // Ignore — leave dividend / growth null.
    }
  }

  let name: string | null = null;
  let currency = "USD";
  if (refRes.ok) {
    try {
      const ref: unknown = await refRes.json();
      name = pickString(read(ref, ["results", "name"]));
      currency =
        pickString(read(ref, ["results", "currency_name"]))?.toUpperCase() ??
        currency;
    } catch {
      // Same — best-effort only.
    }
  }

  const dividendYield =
    price && price > 0 && dividend && dividend > 0 ? dividend / price : null;

  return {
    ticker,
    source: "Polygon",
    price,
    dividend,
    dividendYield,
    dividendGrowth3yr,
    currency,
    exchange: null,
    name,
    fetchedAt: new Date().toISOString(),
  };
}

function parsePolygonDividends(events: unknown): DividendEvent[] {
  if (!Array.isArray(events)) return [];
  const out: DividendEvent[] = [];
  for (const ev of events) {
    if (typeof ev !== "object" || ev === null) continue;
    const obj = ev as Record<string, unknown>;
    const dateStr = pickString(obj.ex_dividend_date);
    const amt = pickNumber(obj.cash_amount);
    if (!dateStr || amt === null) continue;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) continue;
    out.push({ date, amount: amt });
  }
  return out;
}

/* ─────────────────────────────────── shared dividend-history maths */

interface DividendEvent {
  date: Date;
  amount: number;
}

function sumLast12Months(events: DividendEvent[]): number | null {
  if (events.length === 0) return null;
  const now = new Date();
  const oneYearAgo = addYears(now, -1);
  let total = 0;
  let any = false;
  for (const ev of events) {
    if (ev.date > oneYearAgo && ev.date <= now) {
      total += ev.amount;
      any = true;
    }
  }
  return any && total > 0 ? total : null;
}

/**
 * 3-year dividend CAGR. Compares the dividend total over the trailing 12
 * months to the total over the 12 months ending 3 years ago. Outlier-guarded
 * because special dividends and split-adjusted hiccups produce noise.
 */
function compute3yrCagr(events: DividendEvent[]): number | null {
  if (events.length === 0) return null;
  const now = new Date();
  const recentStart = addYears(now, -1);
  const oldEnd = addYears(now, -3);
  const oldStart = addYears(now, -4);

  let recentSum = 0;
  let oldSum = 0;
  for (const ev of events) {
    if (ev.date > recentStart && ev.date <= now) recentSum += ev.amount;
    else if (ev.date > oldStart && ev.date <= oldEnd) oldSum += ev.amount;
  }
  if (recentSum <= 0 || oldSum <= 0) return null;
  const cagr = Math.pow(recentSum / oldSum, 1 / 3) - 1;
  if (!Number.isFinite(cagr)) return null;
  // Asymmetric band: dividend cuts more common than 30%+ sustained hikes;
  // tightened on the negative side after SCHD's 3-for-1 split threw -26%
  // in May 2026.
  if (cagr < -0.2 || cagr > 0.3) return null;
  return cagr;
}

function addYears(date: Date, years: number): Date {
  const out = new Date(date);
  out.setFullYear(date.getFullYear() + years);
  return out;
}

/* ─────────────────────────────────── small helpers */

function read(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof k === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[k];
    } else {
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[k];
    }
  }
  return cur;
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;
  return null;
}

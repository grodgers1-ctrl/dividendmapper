import { NextResponse } from "next/server";

/**
 * Ticker quote endpoint — used by the DCF calculator's "Fetch" button.
 *
 *   GET /api/market/quote?ticker=SCHD
 *   GET /api/market/quote?ticker=ULVR.L
 *
 * Routing:
 *   .L / .LON suffix → EODHD
 *   anything else    → Polygon
 *
 * 15-minute in-memory cache per ticker. Memory is per Vercel function
 * instance and resets on cold start; that's fine for Phase 1 traffic.
 *
 * The route is best-effort: any field the upstream API can't supply comes
 * back as null and the user types it in. The DCF calculator must work
 * without a successful fetch, so failures shouldn't block the UI.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface QuoteData {
  ticker: string;
  source: "EODHD" | "Polygon";
  /** Last close, in the security's listed currency. */
  price: number | null;
  /** Annual dividend per share (forward where available, else TTM). */
  dividend: number | null;
  /** Trailing dividend yield = dividend / price. */
  dividendYield: number | null;
  /** Listed currency, ISO code (e.g. "GBP", "USD", "GBX" for pence). */
  currency: string | null;
  exchange: string | null;
  /** Plain-English company name when the upstream API supplies it. */
  name: string | null;
  fetchedAt: string;
}

interface CacheEntry {
  data: QuoteData;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
// Belt-and-braces: hard-cap the cache so a misbehaving client can't OOM the
// function instance by spraying random tickers at it.
const MAX_CACHE_ENTRIES = 500;

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!raw || !TICKER_RE.test(raw)) {
    return NextResponse.json(
      { ok: false, error: "invalid_ticker" },
      { status: 400 }
    );
  }

  const cached = cache.get(raw);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ ok: true, data: cached.data, cached: true });
  }

  const isUk = raw.endsWith(".L") || raw.endsWith(".LON");
  try {
    const data = isUk ? await fetchEodhd(raw) : await fetchPolygon(raw);
    putInCache(raw, data);
    return NextResponse.json({ ok: true, data, cached: false });
  } catch (err) {
    console.error("[market/quote]", raw, err);
    const code = err instanceof QuoteError ? err.code : "fetch_failed";
    const status = err instanceof QuoteError && err.status ? err.status : 502;
    return NextResponse.json({ ok: false, error: code }, { status });
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

class QuoteError extends Error {
  constructor(
    public code: string,
    public status?: number
  ) {
    super(code);
  }
}

/* ─────────────────────────────────── EODHD (UK / LSE) */

async function fetchEodhd(ticker: string): Promise<QuoteData> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new QuoteError("eodhd_unconfigured", 503);

  // EODHD wants e.g. ULVR.L — already in this format. Strip ".LON" alias.
  const symbol = ticker.replace(/\.LON$/, ".L");

  const [quoteRes, fundRes] = await Promise.all([
    fetch(
      `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json`,
      { cache: "no-store" }
    ),
    fetch(
      `https://eodhd.com/api/fundamentals/${encodeURIComponent(symbol)}?api_token=${apiKey}`,
      { cache: "no-store" }
    ),
  ]);

  if (!quoteRes.ok) {
    if (quoteRes.status === 404) throw new QuoteError("ticker_not_found", 404);
    throw new QuoteError(`eodhd_quote_${quoteRes.status}`);
  }
  const quote: unknown = await quoteRes.json();
  const price = pickNumber(read(quote, ["close"])) ?? pickNumber(read(quote, ["previousClose"]));

  let dividend: number | null = null;
  let currency: string | null = null;
  let exchange: string | null = null;
  let name: string | null = null;

  if (fundRes.ok) {
    try {
      const fund: unknown = await fundRes.json();
      dividend =
        pickNumber(read(fund, ["SplitsDividends", "ForwardAnnualDividendRate"])) ??
        pickNumber(read(fund, ["Highlights", "DividendShare"])) ??
        null;
      currency = pickString(read(fund, ["General", "CurrencyCode"]));
      exchange = pickString(read(fund, ["General", "Exchange"]));
      name = pickString(read(fund, ["General", "Name"]));
    } catch {
      // Fundamentals are a best-effort enrichment — fall through with nulls.
    }
  }

  // EODHD reports LSE prices in pence (GBX) by default. Convert to GBP so the
  // calculator's currency symbol matches the dividend.
  const adjustedPrice =
    currency === "GBX" && price !== null ? price / 100 : price;
  const adjustedCurrency = currency === "GBX" ? "GBP" : currency ?? "GBP";

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
    currency: adjustedCurrency,
    exchange,
    name,
    fetchedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────── Polygon (US) */

async function fetchPolygon(ticker: string): Promise<QuoteData> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new QuoteError("polygon_unconfigured", 503);

  const [snapshotRes, dividendsRes, refRes] = await Promise.all([
    fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`,
      { cache: "no-store" }
    ),
    fetch(
      `https://api.polygon.io/v3/reference/dividends?ticker=${encodeURIComponent(ticker)}&order=desc&limit=20&apiKey=${apiKey}`,
      { cache: "no-store" }
    ),
    fetch(
      `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${apiKey}`,
      { cache: "no-store" }
    ),
  ]);

  if (!snapshotRes.ok) {
    if (snapshotRes.status === 404) throw new QuoteError("ticker_not_found", 404);
    throw new QuoteError(`polygon_snapshot_${snapshotRes.status}`);
  }

  const snapshot: unknown = await snapshotRes.json();
  const price = pickNumber(read(snapshot, ["results", 0, "c"]));

  let dividend: number | null = null;
  if (dividendsRes.ok) {
    try {
      const dividendsData: unknown = await dividendsRes.json();
      dividend = sumLast12MonthsDividends(read(dividendsData, ["results"]));
    } catch {
      // Ignore — leave dividend null.
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
    currency,
    exchange: null,
    name,
    fetchedAt: new Date().toISOString(),
  };
}

function sumLast12MonthsDividends(events: unknown): number | null {
  if (!Array.isArray(events) || events.length === 0) return null;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  let total = 0;
  let any = false;
  for (const ev of events) {
    if (typeof ev !== "object" || ev === null) continue;
    const obj = ev as Record<string, unknown>;
    const dateStr = pickString(obj.ex_dividend_date);
    const cash = pickNumber(obj.cash_amount);
    if (!dateStr || cash === null) continue;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) continue;
    if (date >= cutoff) {
      total += cash;
      any = true;
    }
  }
  return any && total > 0 ? total : null;
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

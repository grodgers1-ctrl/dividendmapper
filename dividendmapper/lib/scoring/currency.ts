// Currency normalisation for scoring. FMP returns LSE prices in GBp (pence)
// commonly labelled "GBp" or "GBX". Other supported currencies: USD, EUR,
// CAD. All output in GBP for consistent portfolio aggregation.
//
// FX cached per cron run via Frankfurter.app (free, no API key, daily rates).
// The in-memory cache is per Vercel function instance; resets on cold start.

const FRANKFURTER_BASE = "https://api.frankfurter.app";
const FX_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED = new Set(["GBP", "GBp", "GBX", "USD", "EUR", "CAD"]);

interface FxCacheEntry {
  rateToGbp: number;
  expires: number;
}
const fxCache = new Map<string, FxCacheEntry>();

export function __clearFxCacheForTest(): void {
  fxCache.clear();
}

async function getRateToGbp(currency: string): Promise<number> {
  const cached = fxCache.get(currency);
  if (cached && cached.expires > Date.now()) return cached.rateToGbp;

  const url = `${FRANKFURTER_BASE}/latest?from=${currency}&to=GBP`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Frankfurter FX fetch failed for ${currency}: ${res.status}`);
  }
  const data = (await res.json()) as { rates: { GBP: number } };
  const rate = data.rates?.GBP;
  if (typeof rate !== "number") {
    throw new Error(`Frankfurter returned no GBP rate for ${currency}`);
  }
  fxCache.set(currency, { rateToGbp: rate, expires: Date.now() + FX_TTL_MS });
  return rate;
}

export async function normalizePriceToGbp(
  price: number,
  currency: string,
): Promise<number> {
  if (!SUPPORTED.has(currency)) {
    throw new Error(`unsupported currency: ${currency}`);
  }
  if (currency === "GBP") return price;
  if (currency === "GBp" || currency === "GBX") return price / 100;
  const rate = await getRateToGbp(currency);
  return price * rate;
}

// Detect "this looks like LSE pence" — FMP sometimes labels them "GBp",
// sometimes "GBX". Treat both identically.
export function isPence(currency: string): boolean {
  return currency === "GBp" || currency === "GBX";
}

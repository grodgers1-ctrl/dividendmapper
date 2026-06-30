// Thin wrapper around the Alpha Vantage ETF_PROFILE endpoint. Used by the
// ETF holdings resolver to fill the look-through gap left by FMP for US-listed
// funds. LSE tickers (e.g. VWRL.L) return an empty body — caller treats that
// as "no AV data, fall back to next source".
//
// Free tier is 25 requests/day. When AV signals exhaustion (an Information or
// Note key in the response body), we flip a module-level `rateLimited` flag
// so the resolver can skip remaining AV calls for the rest of the run. The
// flag is intentionally process-scoped: it persists across calls within a
// single nightly cron invocation and resets on the next cold start.

export interface AvHolding {
  symbol: string;
  description: string;
  weight: string;
}

export interface AvSector {
  sector: string;
  weight: string;
}

export interface AvEtfProfile {
  net_assets?: string;
  net_expense_ratio?: string;
  portfolio_turnover?: string;
  dividend_yield?: string;
  inception_date?: string;
  leveraged?: string;
  sectors?: AvSector[];
  holdings?: AvHolding[];
}

let rateLimited = false;

export function isAvRateLimited(): boolean {
  return rateLimited;
}

export async function getAvEtfProfile(symbol: string): Promise<AvEtfProfile | null> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) throw new Error("ALPHAVANTAGE_API_KEY missing");
  const url = `https://www.alphavantage.co/query?function=ETF_PROFILE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as Record<string, unknown>;
  if ("Information" in j || "Note" in j) {
    rateLimited = true;
    return null;
  }
  if (!j || Object.keys(j).length === 0) return null;
  return j as AvEtfProfile;
}

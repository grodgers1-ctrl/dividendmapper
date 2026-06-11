import { isUkTicker } from "@/lib/portfolio/uk-income";

// Per-holding position value for the holdings table: quantity × latest price.
//
// Price comes from the nightly FMP-sourced `equity_score_history.current_price`
// (same source as the income estimate), NOT the rate-limited live quote. Like
// `dividend_per_share`, LSE (.L) prices are in pence (GBX) and convert ÷100 to
// GBP; the scored US universe is already USD. Pure.

export interface TickerPrice {
  /** Price in major display units (GBP/USD), already converted from GBX. */
  price: number;
  currency: string;
}

export type RowValueStatus =
  | { kind: "ok"; amount: number; currency: string }
  | { kind: "no_data" };

export interface RowValueHolding {
  ticker: string;
  quantity: number | string;
}

// Convert a raw `equity_score_history.current_price` into display units +
// currency. Mirrors `scoringDividendQuote`'s unit logic. null if no usable price.
export function scoringPrice(
  ticker: string,
  currentPrice: number | null,
): TickerPrice | null {
  if (currentPrice == null || !(currentPrice > 0)) return null;
  return isUkTicker(ticker)
    ? { price: currentPrice / 100, currency: "GBP" }
    : { price: currentPrice, currency: "USD" };
}

export function resolveRowValue(
  row: RowValueHolding,
  priceByTicker: Record<string, TickerPrice>,
): RowValueStatus {
  const p = priceByTicker[row.ticker];
  if (!p || !(p.price > 0) || !p.currency) return { kind: "no_data" };
  const amount = Number(row.quantity) * p.price;
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "no_data" };
  return { kind: "ok", amount, currency: p.currency };
}

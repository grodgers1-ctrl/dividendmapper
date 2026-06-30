// Per-holding position value for the holdings table: quantity × latest price.
//
// Price comes from the nightly FMP-sourced `equity_score_history.current_price`
// (same source as the income estimate), NOT the rate-limited live quote. Pure.

export interface TickerPrice {
  /** Price in major display units (GBP/USD), already converted from pence. */
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

/**
 * Convert a stored price to display pounds/dollars.
 *
 * Pre-2026-06-30 LSE rows stored prices in pence (from the broker sync) and
 * relied on a blanket ticker-suffix divide. FMP /stable/profile returns LSE
 * prices in pounds already, so manual-add rows must NOT be divided. We pass
 * currency explicitly when known and fall back to the legacy heuristic for
 * rows written before this fix.
 */
export function scoringPrice(args: {
  price: number;
  currency: string | null;
  ticker: string;
}): number {
  const { price, currency, ticker } = args;
  if (currency === "GBp" || currency === "GBX") return price / 100;
  if (currency === "GBP" || currency === "USD" || currency === "EUR") return price;
  if (currency === null && ticker.endsWith(".L")) return price / 100;
  return price;
}

// Display currency for the row total. GBp/GBX prices get normalised to GBP
// (pence -> pounds). Null+.L falls back to GBP for legacy rows.
export function displayCurrency(args: {
  currency: string | null;
  ticker: string;
}): string {
  const { currency, ticker } = args;
  if (currency === "GBp" || currency === "GBX" || currency === "GBP") return "GBP";
  if (currency === "USD" || currency === "EUR") return currency;
  if (currency === null && ticker.endsWith(".L")) return "GBP";
  return currency ?? "USD";
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

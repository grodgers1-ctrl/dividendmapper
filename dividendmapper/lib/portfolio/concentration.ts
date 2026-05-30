import type { QuoteResult } from "@/lib/market/quote";

// Per-holding market value (quantity × current price, converted to GBP using the
// same path as the income aggregator) → portfolio weights → concentration flag.
// A holding above the threshold (default 20%) is surfaced as a soft hygiene
// warning. Holdings whose quote price is unavailable are excluded from the total
// AND cannot be flagged (we can't size what we can't price).
//
// FX note: prices for UK (.L) securities are already in GBP (quote.ts converts
// GBX → GBP before returning). US securities report in USD. This function uses
// the raw quoted price for all holdings and labels the result "GBP-equivalent"
// on the assumption that the portfolio is predominantly UK-listed. For a mixed
// GBP/USD portfolio the weights are approximate but directionally correct for a
// hygiene check. A full FX layer can be layered in later.
//
// Same-ticker aggregation: a user may hold the same ticker across multiple
// wrappers (ISA + GIA). Quantities are summed per ticker before computing
// weights so concentration reflects the true economic exposure.

/** Minimum holding shape the concentrator needs. Matches HoldingRow in the page. */
export interface ConcentrationHolding {
  ticker: string;
  quantity: number | string;
}

export interface ConcentrationPosition {
  ticker: string;
  /** Market value expressed in GBP (or local currency where GBP price is unavailable). */
  valueGbp: number;
  /** Portfolio weight as a fraction of the priced total, 0..1. */
  weight: number;
}

export interface ConcentrationResult {
  /** Sum of priced holdings' market values (GBP-equivalent). */
  totalGbp: number;
  /** All priced positions, sorted by value descending. */
  positions: ConcentrationPosition[];
  /** Positions whose weight exceeds the threshold, sorted by weight descending. */
  overweight: { ticker: string; weight: number }[];
  /** The threshold applied (default 0.20). */
  threshold: number;
  /** Count of holdings excluded because their quote price was null or unavailable. */
  unpricedCount: number;
}

/**
 * Compute portfolio concentration.
 *
 * @param holdings - All user holdings (full set, not the free-tier-clipped slice).
 * @param quotes   - Quote map returned by fetchPortfolioQuotes + mergeUkDividends.
 * @param threshold - Fraction above which a position is considered concentrated (default 0.20).
 */
export function computeConcentration(
  holdings: ReadonlyArray<ConcentrationHolding>,
  quotes: ReadonlyMap<string, QuoteResult>,
  threshold = 0.2,
): ConcentrationResult {
  if (holdings.length === 0) {
    return {
      totalGbp: 0,
      positions: [],
      overweight: [],
      threshold,
      unpricedCount: 0,
    };
  }

  // 1. Aggregate quantity per ticker across all wrappers.
  const quantityByTicker = new Map<string, number>();
  for (const h of holdings) {
    const qty = Number(h.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    quantityByTicker.set(
      h.ticker,
      (quantityByTicker.get(h.ticker) ?? 0) + qty,
    );
  }

  // 2. For each ticker, look up price and compute market value.
  //    Holdings with no usable price are counted as unpriced and excluded.
  const pricedValues: { ticker: string; valueGbp: number }[] = [];
  let unpricedCount = 0;

  for (const [ticker, totalQty] of quantityByTicker) {
    const result = quotes.get(ticker);
    const price = result?.ok ? result.data.price : null;
    if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) {
      // Track how many input holdings were unpriced (not unique tickers, since
      // the user sees "holding rows"; count raw holdings rows for this ticker).
      const rowsForTicker = holdings.filter((h) => h.ticker === ticker).length;
      unpricedCount += rowsForTicker;
      continue;
    }
    const valueGbp = totalQty * price;
    if (!Number.isFinite(valueGbp) || valueGbp <= 0) {
      const rowsForTicker = holdings.filter((h) => h.ticker === ticker).length;
      unpricedCount += rowsForTicker;
      continue;
    }
    pricedValues.push({ ticker, valueGbp });
  }

  const totalGbp = pricedValues.reduce((sum, p) => sum + p.valueGbp, 0);

  if (totalGbp <= 0) {
    return {
      totalGbp: 0,
      positions: [],
      overweight: [],
      threshold,
      unpricedCount,
    };
  }

  // 3. Compute weights and sort descending.
  const positions: ConcentrationPosition[] = pricedValues
    .map((p) => ({
      ticker: p.ticker,
      valueGbp: p.valueGbp,
      weight: p.valueGbp / totalGbp,
    }))
    .sort((a, b) => b.weight - a.weight);

  // 4. Flag any position above the threshold.
  const overweight = positions
    .filter((p) => p.weight > threshold)
    .map((p) => ({ ticker: p.ticker, weight: p.weight }));

  return {
    totalGbp,
    positions,
    overweight,
    threshold,
    unpricedCount,
  };
}

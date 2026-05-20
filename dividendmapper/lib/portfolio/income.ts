import type { QuoteResult } from "@/lib/market/quote";

// Per-(wrapper × dividend-currency) income roll-up for the portfolio view.
//
// Pure transformation — no Supabase, no fetch. The page orchestrates the
// holdings query and quote fetch (via lib/portfolio/quotes) then hands both
// to this function. Keeping the lib pure means it's trivially unit-testable
// and the data lifecycle lives in one place (the page).
//
// Aggregation is by (wrapper × dividend-currency), not just wrapper: a UK
// user holding AAPL in their ISA gets a "ISA · USD" row distinct from a
// "ISA · GBP" row for ULVR. Source-currency display only at launch — no FX
// conversion.

export type WrapperKey =
  | "isa"
  | "sipp"
  | "gia"
  | "401k"
  | "ira"
  | "roth_ira"
  | "brokerage";

export interface IncomeRow {
  /** Composite key — stable for React `key` prop. */
  key: string;
  wrapper: WrapperKey;
  currency: string;
  /** Annual dividend income summed across holdings in this bucket. */
  annualIncome: number;
  holdingsCount: number;
}

export interface IncomeCurrencyTotal {
  currency: string;
  total: number;
}

export interface PortfolioIncome {
  rows: IncomeRow[];
  totalsByCurrency: IncomeCurrencyTotal[];
  holdingsCount: number;
  /** Holdings whose dividend lookup returned null (e.g. LSE on free EODHD). */
  missingDividendCount: number;
  fetchedAt: string;
}

/** Minimum holding shape the aggregator needs. */
export interface IncomeHolding {
  ticker: string;
  quantity: number | string;
  wrapper: string;
}

const VALID_WRAPPERS: ReadonlySet<WrapperKey> = new Set([
  "isa",
  "sipp",
  "gia",
  "401k",
  "ira",
  "roth_ira",
  "brokerage",
]);

function isWrapperKey(value: string): value is WrapperKey {
  return VALID_WRAPPERS.has(value as WrapperKey);
}

const EMPTY: PortfolioIncome = {
  rows: [],
  totalsByCurrency: [],
  holdingsCount: 0,
  missingDividendCount: 0,
  fetchedAt: new Date(0).toISOString(),
};

export function aggregatePortfolioIncome<T extends IncomeHolding>(
  holdings: ReadonlyArray<T>,
  quotes: ReadonlyMap<string, QuoteResult>,
): PortfolioIncome {
  if (holdings.length === 0) {
    return { ...EMPTY, fetchedAt: new Date().toISOString() };
  }

  // Bucket by (wrapper × dividend-currency). Holdings with no usable dividend
  // (failed quote, null dividend, unknown currency, unknown wrapper) get
  // counted as "missing" so the UI can show "N rows have no dividend data."
  const buckets = new Map<
    string,
    { wrapper: WrapperKey; currency: string; total: number; count: number }
  >();
  let missing = 0;

  for (const h of holdings) {
    if (!isWrapperKey(h.wrapper)) {
      missing += 1;
      continue;
    }
    const quote = quotes.get(h.ticker);
    if (!quote || !quote.ok) {
      missing += 1;
      continue;
    }
    const { dividend: dps, currency } = quote.data;
    if (!dps || dps <= 0 || !currency) {
      missing += 1;
      continue;
    }
    const annual = Number(h.quantity) * dps;
    if (!Number.isFinite(annual) || annual <= 0) {
      missing += 1;
      continue;
    }
    const key = `${h.wrapper}:${currency}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.total += annual;
      existing.count += 1;
    } else {
      buckets.set(key, {
        wrapper: h.wrapper,
        currency,
        total: annual,
        count: 1,
      });
    }
  }

  const rows: IncomeRow[] = Array.from(buckets.entries())
    .map(([key, b]) => ({
      key,
      wrapper: b.wrapper,
      currency: b.currency,
      annualIncome: b.total,
      holdingsCount: b.count,
    }))
    .sort((a, b) => b.annualIncome - a.annualIncome);

  const currencyTotals = new Map<string, number>();
  for (const row of rows) {
    currencyTotals.set(
      row.currency,
      (currencyTotals.get(row.currency) ?? 0) + row.annualIncome,
    );
  }
  const totalsByCurrency: IncomeCurrencyTotal[] = Array.from(
    currencyTotals.entries(),
  )
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    totalsByCurrency,
    holdingsCount: holdings.length,
    missingDividendCount: missing,
    fetchedAt: new Date().toISOString(),
  };
}

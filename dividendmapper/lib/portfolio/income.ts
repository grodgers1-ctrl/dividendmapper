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
  /**
   * Where this bucket's figure came from: 'actual' if every contributing
   * holding had real broker-synced dividends, 'estimate' if all were the FMP
   * quantity×dps estimate, 'mixed' if the bucket blends both.
   */
  source: "actual" | "estimate" | "mixed";
}

/** A holding's trailing-12-month ACTUAL dividend income, from broker sync. */
export interface ActualIncome {
  amount: number;
  currency: string;
}

/** Actuals map key: `${tickerScoring}::${wrapper}` (holdings.ticker is the scoring ticker). */
export function actualKey(ticker: string, wrapper: string): string {
  return `${ticker}::${wrapper}`;
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
  actuals: ReadonlyMap<string, ActualIncome> = new Map(),
): PortfolioIncome {
  if (holdings.length === 0) {
    return { ...EMPTY, fetchedAt: new Date().toISOString() };
  }

  // Bucket by (wrapper × dividend-currency). Income is a FORWARD annual
  // run-rate, so per holding we PREFER the FMP quantity×dps estimate; a
  // broker-synced actual is only a fallback for tickers FMP doesn't score
  // (actuals are a trailing sum that under-reports positions bought partway
  // through the year, so they must not override the estimate). Holdings with
  // neither (failed quote, null dividend, unknown currency/wrapper) are counted
  // as "missing" so the UI can show "N rows have no dividend data."
  // actualCount/estimateCount drive the row's source label.
  const buckets = new Map<
    string,
    {
      wrapper: WrapperKey;
      currency: string;
      total: number;
      count: number;
      actualCount: number;
      estimateCount: number;
    }
  >();
  let missing = 0;

  const add = (
    wrapper: WrapperKey,
    currency: string,
    annual: number,
    kind: "actual" | "estimate",
  ) => {
    const key = `${wrapper}:${currency}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.total += annual;
      existing.count += 1;
      if (kind === "actual") existing.actualCount += 1;
      else existing.estimateCount += 1;
    } else {
      buckets.set(key, {
        wrapper,
        currency,
        total: annual,
        count: 1,
        actualCount: kind === "actual" ? 1 : 0,
        estimateCount: kind === "estimate" ? 1 : 0,
      });
    }
  };

  for (const h of holdings) {
    if (!isWrapperKey(h.wrapper)) {
      missing += 1;
      continue;
    }

    // Forward estimate wins, in the quote's listed currency.
    const quote = quotes.get(h.ticker);
    if (quote?.ok) {
      const { dividend: dps, currency } = quote.data;
      if (dps && dps > 0 && currency) {
        const annual = Number(h.quantity) * dps;
        if (Number.isFinite(annual) && annual > 0) {
          add(h.wrapper, currency, annual, "estimate");
          continue;
        }
      }
    }

    // No forward estimate (FMP doesn't score this ticker) — fall back to the
    // real broker-synced income, in its own (account) currency.
    const actual = actuals.get(actualKey(h.ticker, h.wrapper));
    if (actual && actual.amount > 0 && actual.currency) {
      add(h.wrapper, actual.currency, actual.amount, "actual");
      continue;
    }

    missing += 1;
  }

  const rows: IncomeRow[] = Array.from(buckets.entries())
    .map(([key, b]) => ({
      key,
      wrapper: b.wrapper,
      currency: b.currency,
      annualIncome: b.total,
      holdingsCount: b.count,
      source:
        b.actualCount > 0 && b.estimateCount > 0
          ? ("mixed" as const)
          : b.actualCount > 0
            ? ("actual" as const)
            : ("estimate" as const),
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

/**
 * FX-convert per-currency income totals to a single GBP figure.
 *
 * Rows whose currency is missing from `ratesToGbp`, or whose rate is
 * non-finite/non-positive, are silently dropped — matching how
 * `ratesToGbpFor()` omits unsupported currencies. Returns 0 for an empty
 * input. The dashboard hero uses this; the Ledger keeps source-currency rows.
 */
export function sumIncomeGbp(
  totals: ReadonlyArray<IncomeCurrencyTotal>,
  ratesToGbp: Readonly<Record<string, number>>,
): number {
  return totals.reduce((acc, row) => {
    const rate = ratesToGbp[row.currency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return acc;
    }
    return acc + row.total * rate;
  }, 0);
}

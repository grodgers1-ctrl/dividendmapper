import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchQuote, type QuoteData } from "@/lib/market/quote";

// Per-wrapper-and-currency income roll-up for the portfolio view.
//
// Aggregation is by (wrapper × dividend-currency), not just wrapper: a UK
// user holding AAPL in their ISA gets a "ISA · USD" row distinct from a
// "ISA · GBP" row for ULVR. Source-currency display only at launch — no FX
// conversion. See planning/05-phase2-sprint.md day 5.
//
// Quotes come from the shared `lib/market/quote.ts` cache (15-min TTL per
// ticker). The lib dedupes tickers before fetching so multiple holdings of
// the same ticker only cost one upstream call.

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

interface HoldingRow {
  id: string;
  ticker: string;
  quantity: number;
  wrapper: string;
  cost_currency: string;
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

export async function getPortfolioIncome(
  userId: string,
): Promise<PortfolioIncome> {
  const supabase = await createSupabaseServerClient();

  // No tier cap — income must reflect all holdings, even ones hidden from the
  // table on a downgraded Pro account. The page-level banner explains.
  const { data, error } = await supabase
    .from("holdings")
    .select("id, ticker, quantity, wrapper, cost_currency")
    .eq("user_id", userId)
    .returns<HoldingRow[]>();

  if (error || !data || data.length === 0) {
    return { ...EMPTY, fetchedAt: new Date().toISOString() };
  }

  // Dedupe tickers so the same security in two wrappers only costs one
  // upstream call. The lib cache would coalesce these eventually but only
  // sequentially — parallel-fetching unique tickers is faster.
  const uniqueTickers = Array.from(new Set(data.map((h) => h.ticker)));
  const quoteResults = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      const result = await fetchQuote(ticker);
      return [ticker, result.ok ? result.data : null] as const;
    }),
  );
  const quotes = new Map<string, QuoteData | null>(quoteResults);

  // Bucket by (wrapper × dividend-currency). Holdings with no usable dividend
  // (null quote, null dividend, unknown currency, unknown wrapper) get
  // counted as "missing" so the UI can show "N rows have no dividend data."
  const buckets = new Map<
    string,
    { wrapper: WrapperKey; currency: string; total: number; count: number }
  >();
  let missing = 0;

  for (const h of data) {
    if (!isWrapperKey(h.wrapper)) {
      missing += 1;
      continue;
    }
    const quote = quotes.get(h.ticker);
    const dps = quote?.dividend ?? null;
    const currency = quote?.currency ?? null;
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
    holdingsCount: data.length,
    missingDividendCount: missing,
    fetchedAt: new Date().toISOString(),
  };
}

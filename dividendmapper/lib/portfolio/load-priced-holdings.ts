import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteResult } from "@/lib/market/quote";
import {
  aggregatePortfolioIncome,
  actualKey,
  type ActualIncome,
  type PortfolioIncome,
} from "@/lib/portfolio/income";
import { fetchPortfolioQuotes } from "@/lib/portfolio/quotes";
import { mergeScoringDividends } from "@/lib/portfolio/uk-income";
import { scoringPrice, type TickerPrice } from "@/lib/portfolio/row-value";
import {
  aggregatePortfolioValue,
  type ValueCurrencyTotal,
} from "@/lib/portfolio/portfolio-value";
import { FREE_TIER_LIMIT } from "@/app/app/portfolio/_components/free-tier-copy";

export type HoldingRow = {
  id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  wrapper: string;
  broker_label: string | null;
  notes: string | null;
  created_at: string;
  /** Provenance: where the row came from (Phase 3 broker sync). */
  source: "manual" | "trading212" | "csv";
};

const TTM_DAYS = 365;

export interface PricedHoldings {
  tier: "free" | "pro" | "premium";
  allHoldings: HoldingRow[];
  visibleRows: HoldingRow[];
  total: number;
  hiddenCount: number;
  atFreeLimit: boolean;
  holdingsError: unknown;
  quotes: Map<string, QuoteResult>;
  quotesByTicker: Record<string, QuoteResult>;
  /** Per-holding real synced dividends (TTM), keyed `ticker::wrapper`. */
  actualsByKey: Record<string, ActualIncome>;
  /** Latest FMP price per ticker (display units), for the table's Value column. */
  priceByTicker: Record<string, TickerPrice>;
  /** Per-currency portfolio total value (quantity × price). */
  valueTotalsByCurrency: ValueCurrencyTotal[];
  /** Company name per ticker (FMP profile), for the table. Ticker falls back. */
  nameByTicker: Record<string, string>;
  income: PortfolioIncome;
}

/**
 * Shared loader for both the ledger and the Portfolio Manager page: holdings +
 * quotes (with the UK .L dividend patch) + income roll-up + free-tier slicing.
 * The income aggregator is a pure function over (holdings, quotes).
 */
export async function loadPricedHoldings(userId: string): Promise<PricedHoldings> {
  const supabase = await createSupabaseServerClient();

  // Single holdings query covers both the table render and the income roll-up.
  // We query the unbounded set and slice in memory for the free-tier cap, so
  // the income chart can count holdings hidden from the table without a
  // second round-trip.
  const [profileResult, holdingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle<{ tier: "free" | "pro" | "premium" }>(),
    supabase
      .from("holdings")
      .select(
        "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at, source",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .returns<HoldingRow[]>(),
  ]);

  const tier = profileResult.data?.tier ?? "free";
  const allHoldings = holdingsResult.data ?? [];
  const holdingsError = holdingsResult.error;
  const total = allHoldings.length;
  const visibleRows =
    tier === "free" ? allHoldings.slice(0, FREE_TIER_LIMIT) : allHoldings;
  const atFreeLimit = tier === "free" && total >= FREE_TIER_LIMIT;
  const hiddenCount = tier === "free" ? Math.max(0, total - FREE_TIER_LIMIT) : 0;

  const rawQuotes = await fetchPortfolioQuotes(allHoldings);

  // FMP is our dividend source. The live quote path (Polygon for US, EODHD for
  // LSE) is only a backup and is rate-limited (a burst of parallel calls 429s),
  // so income reads each holding's dividend from the nightly FMP-sourced
  // equity_score_history instead — for EVERY ticker, US and LSE alike. This is
  // also why a Polygon 429 no longer drops a US holding's income.
  const allTickers = [...new Set(allHoldings.map((h) => h.ticker))];
  const scoringDividendByTicker = new Map<string, number>();
  const priceByTicker: Record<string, TickerPrice> = {};
  const nameByTicker: Record<string, string> = {};
  if (allTickers.length > 0) {
    const { data: divRows } = await supabase
      .from("equity_score_history")
      .select("ticker, dividend_per_share, current_price, observed_at")
      .in("ticker", allTickers)
      .order("observed_at", { ascending: false })
      .returns<
        {
          ticker: string;
          dividend_per_share: number | null;
          current_price: number | null;
          observed_at: string;
        }[]
      >();
    for (const r of divRows ?? []) {
      // rows are newest-first; keep the first (latest) non-null per ticker.
      if (!scoringDividendByTicker.has(r.ticker) && r.dividend_per_share != null) {
        scoringDividendByTicker.set(r.ticker, Number(r.dividend_per_share));
      }
      if (!(r.ticker in priceByTicker)) {
        const p = scoringPrice(r.ticker, r.current_price);
        if (p) priceByTicker[r.ticker] = p;
      }
    }

    // Company names live on equity_scores (latest snapshot), written nightly
    // from the FMP profile. Ticker falls back when absent (manual/unscored).
    const { data: nameRows } = await supabase
      .from("equity_scores")
      .select("ticker, name")
      .in("ticker", allTickers)
      .returns<{ ticker: string; name: string | null }[]>();
    for (const r of nameRows ?? []) {
      if (r.name) nameByTicker[r.ticker] = r.name;
    }
  }
  const quotes = mergeScoringDividends(rawQuotes, allTickers, scoringDividendByTicker);
  const { totalsByCurrency: valueTotalsByCurrency } = aggregatePortfolioValue(
    allHoldings,
    priceByTicker,
  );

  // Per-user ACTUAL dividends (broker sync): TTM sum per (ticker_scoring ×
  // wrapper), in the account currency. Preferred over the FMP estimate by the
  // aggregator. RLS scopes user_dividends to this user.
  const since = new Date(Date.now() - TTM_DAYS * 86400000).toISOString().slice(0, 10);
  const { data: dividendRows } = await supabase
    .from("user_dividends")
    .select("ticker_scoring, wrapper, amount, currency")
    .gte("paid_on", since)
    .returns<
      { ticker_scoring: string | null; wrapper: string; amount: number; currency: string }[]
    >();
  const actuals = new Map<string, ActualIncome>();
  for (const d of dividendRows ?? []) {
    if (!d.ticker_scoring) continue;
    const key = actualKey(d.ticker_scoring, d.wrapper);
    const existing = actuals.get(key);
    if (existing) existing.amount += Number(d.amount);
    else actuals.set(key, { amount: Number(d.amount), currency: d.currency });
  }

  const income = aggregatePortfolioIncome(allHoldings, quotes, actuals);

  // Map doesn't reliably survive Next's router cache when crossing the
  // server/client boundary; the table receives an empty Map on return
  // navigation. Plain object survives.
  const quotesByTicker = Object.fromEntries(quotes);
  const actualsByKey = Object.fromEntries(actuals);

  return {
    tier,
    allHoldings,
    visibleRows,
    total,
    hiddenCount,
    atFreeLimit,
    holdingsError,
    quotes,
    quotesByTicker,
    actualsByKey,
    priceByTicker,
    valueTotalsByCurrency,
    nameByTicker,
    income,
  };
}

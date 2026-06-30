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
import {
  displayCurrency,
  scoringPrice,
  type TickerPrice,
} from "@/lib/portfolio/row-value";
import {
  aggregatePortfolioValue,
  type ValueCurrencyTotal,
} from "@/lib/portfolio/portfolio-value";
import { FREE_TIER_LIMIT } from "@/app/app/portfolio/_components/free-tier-copy";
import {
  loadSparklineSeriesByTicker,
  type SparklineSeries,
} from "@/lib/portfolio/load-sparkline-series";

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
  /** Distribution policy per ETF ticker (from etf_universe). Non-ETF tickers absent. */
  policyByTicker: Record<string, "Distributing" | "Accumulating" | "Unknown">;
  /** asset_type per ticker. Missing tickers default to "equity" downstream. */
  assetTypeByTicker: Record<string, string>;
  /** 5Y daily-close series per visible ticker for the row sparklines. Empty
   *  for tickers where ticker_price_history has no data yet. */
  sparklineByTicker: Record<string, SparklineSeries>;
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
  const policyByTicker: PricedHoldings["policyByTicker"] = {};
  const assetTypeByTicker: PricedHoldings["assetTypeByTicker"] = {};
  if (allTickers.length > 0) {
    const { data: divRows } = await supabase
      .from("equity_score_history")
      .select(
        "ticker, dividend_per_share, current_price, current_price_currency, observed_at",
      )
      .in("ticker", allTickers)
      .order("observed_at", { ascending: false })
      .returns<
        {
          ticker: string;
          dividend_per_share: number | null;
          current_price: number | null;
          current_price_currency: string | null;
          observed_at: string;
        }[]
      >();
    for (const r of divRows ?? []) {
      // rows are newest-first; keep the first (latest) non-null per ticker.
      if (!scoringDividendByTicker.has(r.ticker) && r.dividend_per_share != null) {
        scoringDividendByTicker.set(r.ticker, Number(r.dividend_per_share));
      }
      if (
        !(r.ticker in priceByTicker) &&
        r.current_price != null &&
        r.current_price > 0
      ) {
        const price = scoringPrice({
          price: r.current_price,
          currency: r.current_price_currency,
          ticker: r.ticker,
        });
        priceByTicker[r.ticker] = {
          price,
          currency: displayCurrency({
            currency: r.current_price_currency,
            ticker: r.ticker,
          }),
        };
      }
    }

    // Company names live on equity_scores (latest snapshot), written nightly
    // from the FMP profile. Ticker falls back when absent (manual/unscored).
    // ETF distribution policy lives on etf_universe; asset_type on tickers —
    // both feed the holding-row Accumulating pill and ETF badge.
    const [nameRes, policyRes, assetTypeRes] = await Promise.all([
      supabase
        .from("equity_scores")
        .select("ticker, name")
        .in("ticker", allTickers)
        .returns<{ ticker: string; name: string | null }[]>(),
      supabase
        .from("etf_universe")
        .select("ticker, distribution_policy")
        .in("ticker", allTickers)
        .returns<
          {
            ticker: string;
            distribution_policy:
              | "Distributing"
              | "Accumulating"
              | "Unknown"
              | null;
          }[]
        >(),
      supabase
        .from("tickers")
        .select("ticker, asset_type")
        .in("ticker", allTickers)
        .returns<{ ticker: string; asset_type: string }[]>(),
    ]);
    for (const r of nameRes.data ?? []) {
      if (r.name) nameByTicker[r.ticker] = r.name;
    }
    for (const r of policyRes.data ?? []) {
      if (r.distribution_policy) {
        policyByTicker[r.ticker] = r.distribution_policy;
      }
    }
    for (const r of assetTypeRes.data ?? []) {
      assetTypeByTicker[r.ticker] = r.asset_type;
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

  const income = aggregatePortfolioIncome(
    allHoldings,
    quotes,
    actuals,
    policyByTicker,
  );

  // Map doesn't reliably survive Next's router cache when crossing the
  // server/client boundary; the table receives an empty Map on return
  // navigation. Plain object survives.
  const quotesByTicker = Object.fromEntries(quotes);
  const actualsByKey = Object.fromEntries(actuals);

  // 5Y daily-close series per visible-ticker for the row sparklines. We load
  // the full 5Y window once and let the client slice per active range.
  const visibleTickers = [...new Set(visibleRows.map((h) => h.ticker))];
  const sparklineMap = await loadSparklineSeriesByTicker(
    supabase,
    visibleTickers,
    "5Y",
  );
  const sparklineByTicker: Record<string, SparklineSeries> =
    Object.fromEntries(sparklineMap);

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
    policyByTicker,
    assetTypeByTicker,
    sparklineByTicker,
    income,
  };
}

/**
 * Archived (superseded/closed) holdings for the current user — the rows the
 * provenance reconcile set `archived_at` on (e.g. a manual holding replaced by
 * a synced one). RLS scopes to the owner. Used by the "Archived holdings" view
 * so users can see and restore/delete what was hidden.
 */
export async function loadArchivedHoldings(): Promise<HoldingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("holdings")
    .select(
      "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at, source",
    )
    .not("archived_at", "is", null)
    .order("created_at", { ascending: false })
    .returns<HoldingRow[]>();
  return data ?? [];
}

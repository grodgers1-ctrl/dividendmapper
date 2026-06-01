import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteResult } from "@/lib/market/quote";
import { aggregatePortfolioIncome, type PortfolioIncome } from "@/lib/portfolio/income";
import { fetchPortfolioQuotes } from "@/lib/portfolio/quotes";
import { isUkTicker, mergeUkDividends } from "@/lib/portfolio/uk-income";
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
};

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
        "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at",
      )
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

  // UK (.L) holdings lost their income when EODHD was cancelled (FMP took over
  // scoring 2026-05-29). FMP already pulls LSE dividends nightly into
  // equity_score_history, so patch those tickers from there (pence -> £).
  const ukTickers = [...new Set(allHoldings.map((h) => h.ticker))].filter(
    isUkTicker,
  );
  const ukDividendByTicker = new Map<string, number>();
  if (ukTickers.length > 0) {
    const { data: ukDivRows } = await supabase
      .from("equity_score_history")
      .select("ticker, dividend_per_share, observed_at")
      .in("ticker", ukTickers)
      .order("observed_at", { ascending: false })
      .returns<
        { ticker: string; dividend_per_share: number | null; observed_at: string }[]
      >();
    for (const r of ukDivRows ?? []) {
      // rows are newest-first; keep the first (latest) per ticker.
      if (!ukDividendByTicker.has(r.ticker) && r.dividend_per_share != null) {
        ukDividendByTicker.set(r.ticker, Number(r.dividend_per_share));
      }
    }
  }
  const quotes = mergeUkDividends(rawQuotes, ukTickers, ukDividendByTicker);

  const income = aggregatePortfolioIncome(allHoldings, quotes);

  // Map doesn't reliably survive Next's router cache when crossing the
  // server/client boundary; the table receives an empty Map on return
  // navigation. Plain object survives.
  const quotesByTicker = Object.fromEntries(quotes);

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
    income,
  };
}

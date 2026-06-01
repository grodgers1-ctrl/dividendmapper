import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteResult } from "@/lib/market/quote";
import {
  computeConcentration,
  type ConcentrationResult,
} from "@/lib/portfolio/concentration";
import { ratesToGbpFor } from "@/lib/scoring/currency";
import { isUkTicker } from "@/lib/portfolio/uk-income";
import {
  buildHoldingScore,
  applyUserWeights,
  flaggedHoldings,
  type HoldingScore,
  type ScoreRow,
  type PriorHistory,
  type OverrideRow,
} from "@/lib/scoring/portfolio-scores";
import {
  buildReinvestCard,
  type ReinvestCard,
  type ExDiv,
} from "@/lib/reinvest/build-card";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";

// 30 trading days ≈ 42 calendar days; the history row at/just before that point
// is the delta baseline. Until ~6 weeks of history accrues this finds nothing
// and deltas stay null (chips simply omit the delta pill).
const DELTA_LOOKBACK_DAYS = 42;

export interface PortfolioAnalytics {
  scoresByTicker: Record<string, HoldingScore>;
  flagged: { ticker: string; hint: string }[];
  concentration: ConcentrationResult;
  reinvestCard: ReinvestCard | null;
  weightByTicker: Record<string, number>;
}

/**
 * Pro+ analytical layer: per-ticker scores (with delta + override state),
 * flagged holdings, concentration, and the Reinvest Recommender card. Pure
 * assembly over the already-priced holdings/quotes from loadPricedHoldings.
 */
export async function loadPortfolioAnalytics(args: {
  userId: string;
  allHoldings: HoldingRow[];
  visibleRows: HoldingRow[];
  quotes: Map<string, QuoteResult>;
  quotesByTicker: Record<string, QuoteResult>;
}): Promise<PortfolioAnalytics> {
  const { userId, allHoldings, visibleRows, quotes, quotesByTicker } = args;
  const supabase = await createSupabaseServerClient();

  // Collect the distinct currencies of priced quotes so we can resolve GBP
  // multipliers before computing concentration weights.
  const pricedCurrencies = [
    ...new Set(
      [...quotes.values()]
        .map((q) => (q.ok ? q.data.currency : null))
        .filter((c): c is string => c !== null),
    ),
  ];
  const ratesToGbp = await ratesToGbpFor(pricedCurrencies);
  const concentration = computeConcentration(allHoldings, quotes, ratesToGbp);

  const scoresByTicker: Record<string, HoldingScore> = {};
  let flagged: { ticker: string; hint: string }[] = [];
  let reinvestCard: ReinvestCard | null = null;
  const weightByTicker: Record<string, number> = {};
  for (const p of concentration.positions) weightByTicker[p.ticker] = p.weight;

  const tickers = [...new Set(visibleRows.map((h) => h.ticker))];
  const now = new Date();
  const cutoff = new Date(now.getTime() - DELTA_LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [scoresRes, overridesRes, historyRes] = await Promise.all([
    supabase
      .from("equity_scores")
      .select(
        "ticker, buy_score, trim_score, risk_score, buy_failed_gates, data_quality, next_ex_div_date, next_ex_div_amount, next_ex_div_pay_date",
      )
      .in("ticker", tickers)
      .returns<
        (ScoreRow & {
          next_ex_div_date: string | null;
          next_ex_div_amount: number | null;
          next_ex_div_pay_date: string | null;
        })[]
      >(),
    supabase
      .from("score_overrides")
      .select("ticker, score_type, expires_at")
      .eq("user_id", userId)
      .returns<(OverrideRow & { ticker: string })[]>(),
    supabase
      .from("equity_score_history")
      .select("ticker, buy_score, trim_score, risk_score, observed_at")
      .in("ticker", tickers)
      .lte("observed_at", cutoff)
      .order("observed_at", { ascending: false })
      .returns<(PriorHistory & { ticker: string; observed_at: string })[]>(),
  ]);

  const overridesByTicker = new Map<string, OverrideRow[]>();
  for (const o of overridesRes.data ?? []) {
    const list = overridesByTicker.get(o.ticker) ?? [];
    list.push({ score_type: o.score_type, expires_at: o.expires_at });
    overridesByTicker.set(o.ticker, list);
  }
  // history is sorted newest-first; first row per ticker is the baseline.
  const priorByTicker = new Map<string, PriorHistory>();
  for (const h of historyRes.data ?? []) {
    if (!priorByTicker.has(h.ticker)) {
      priorByTicker.set(h.ticker, {
        buy_score: h.buy_score,
        trim_score: h.trim_score,
        risk_score: h.risk_score,
      });
    }
  }

  for (const score of scoresRes.data ?? []) {
    scoresByTicker[score.ticker] = applyUserWeights(
      buildHoldingScore({
        score,
        priorHistory: priorByTicker.get(score.ticker) ?? null,
        overrides: overridesByTicker.get(score.ticker) ?? [],
        now,
      }),
      null,
    );
  }
  // Flag from the distinct holdings actually shown.
  flagged = flaggedHoldings(
    tickers.map((t) => scoresByTicker[t]).filter(Boolean),
  );

  // Reinvest Recommender (Pro+). Ex-div dates come from the score rows the
  // nightly cron persists; the rest reuses the already-computed quotes,
  // concentration weights, scores, and FX rates. Pure assembly in build-card.
  const exDivByTicker: Record<string, ExDiv> = {};
  for (const row of scoresRes.data ?? []) {
    if (row.next_ex_div_date) {
      exDivByTicker[row.ticker] = {
        date: row.next_ex_div_date,
        amount: row.next_ex_div_amount,
        payDate: row.next_ex_div_pay_date,
      };
    }
  }

  // Total portfolio income in GBP (same per-share-dividend basis as the income
  // view; .L dividends are already in £, others convert via the FX map).
  const totalPortfolioIncomeGbp = allHoldings.reduce((sum, h) => {
    const qr = quotes.get(h.ticker);
    if (!qr?.ok) return sum;
    const div = qr.data.dividend;
    if (div === null || div === undefined || div <= 0) return sum;
    const rate = isUkTicker(h.ticker)
      ? 1
      : qr.data.currency
        ? ratesToGbp[qr.data.currency]
        : undefined;
    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return sum;
    return sum + Number(h.quantity) * div * rate;
  }, 0);

  reinvestCard = buildReinvestCard({
    holdings: allHoldings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      quantity: Number(h.quantity),
      sector: null,
    })),
    exDivByTicker,
    quotesByTicker,
    ratesToGbp,
    scoresByTicker,
    weightByTicker,
    totalPortfolioIncomeGbp,
    sectorsToAvoid: [],
    today: now.toISOString().slice(0, 10),
    windowDays: 5,
  });

  return { scoresByTicker, flagged, concentration, reinvestCard, weightByTicker };
}

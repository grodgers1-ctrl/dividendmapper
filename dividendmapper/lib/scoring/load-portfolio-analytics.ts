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
  flaggedHoldings,
  type HoldingScore,
  type ScoreRow,
  type PriorHistory,
  type OverrideRow,
} from "@/lib/scoring/portfolio-scores";
import { loadUserPreferences } from "@/lib/scoring/preferences";
import { actionHintSensitivity } from "@/lib/scoring/chip-display";
import { categoryWeightsFor, reaggregateBuyScore } from "@/lib/scoring/reaggregate";
import { loadBuySignals } from "@/lib/scoring/load-buy-signals";
import {
  buildReinvestCard,
  type ReinvestCard,
  type ExDiv,
} from "@/lib/reinvest/build-card";
import {
  buildIncomeCalendar,
  type IncomeCalendarResult,
  type IncomeCalendarExDiv,
} from "@/lib/portfolio/income-calendar";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";

// 30 trading days ≈ 42 calendar days; the history row at/just before that point
// is the delta baseline. Until ~6 weeks of history accrues this finds nothing
// and deltas stay null (chips simply omit the delta pill).
const DELTA_LOOKBACK_DAYS = 42;

export interface TickerFundamentals {
  sector: string | null;
  forwardPe: number | null;
  payoutRatio: number | null; // decimal
  dividendYield: number | null; // decimal
}

export interface NextDividend {
  ticker: string;
  date: string; // YYYY-MM-DD ex-dividend date
  amount: number | null;
  payDate: string | null;
}

export interface PortfolioAnalytics {
  scoresByTicker: Record<string, HoldingScore>;
  flagged: { ticker: string; hint: string }[];
  concentration: ConcentrationResult;
  reinvestCard: ReinvestCard | null;
  weightByTicker: Record<string, number>;
  fundamentalsByTicker: Record<string, TickerFundamentals>;
  nextDividend: NextDividend | null;
  incomeCalendar: IncomeCalendarResult;
}

// Soonest upcoming ex-dividend across the user's held tickers. Ex-div rows in
// the past (date < today) are discarded; null when no future date exists.
function pickNextDividend(
  exDivByTicker: Record<string, ExDiv>,
  today: string,
): NextDividend | null {
  let soonest: NextDividend | null = null;
  for (const [ticker, e] of Object.entries(exDivByTicker)) {
    if (e.date < today) continue;
    if (soonest === null || e.date < soonest.date) {
      soonest = {
        ticker,
        date: e.date,
        amount: e.amount,
        payDate: e.payDate,
      };
    }
  }
  return soonest;
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
  lens?: boolean;
}): Promise<PortfolioAnalytics> {
  const { userId, allHoldings, visibleRows, quotes, quotesByTicker, lens = false } = args;
  const supabase = await createSupabaseServerClient();

  // Personalisation: posture answers tune the Reinvest filter + action-hint
  // sensitivity by default; the score lens (opt-in) re-aggregates buy scores.
  const prefs = await loadUserPreferences(userId);
  const sensitivity = actionHintSensitivity(prefs);

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
  const calendarSince = new Date(now.getTime() - 200 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [scoresRes, overridesRes, historyRes, latestYieldRes, userDividendsForCalendarRes] = await Promise.all([
    supabase
      .from("equity_scores")
      .select(
        "ticker, buy_score, trim_score, risk_score, buy_failed_gates, data_quality, next_ex_div_date, next_ex_div_amount, next_ex_div_pay_date, sector, forward_pe, payout_ratio",
      )
      .in("ticker", tickers)
      .returns<
        (ScoreRow & {
          next_ex_div_date: string | null;
          next_ex_div_amount: number | null;
          next_ex_div_pay_date: string | null;
          sector: string | null;
          forward_pe: number | null;
          payout_ratio: number | null;
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
    // Latest current_yield per ticker — equity_scores has no yield column,
    // so the FundamentalsCard/chip strip reads it from the most recent
    // equity_score_history row instead. observed_at DESC + take-first-per-ticker
    // in JS gets us "latest" without a heavier window query.
    supabase
      .from("equity_score_history")
      .select("ticker, current_yield, observed_at")
      .in("ticker", tickers)
      .order("observed_at", { ascending: false })
      .returns<{ ticker: string; current_yield: number | null; observed_at: string }[]>(),
    // Past ~200 days of received dividends — drives the Income Calendar
    // "actual" + "partial" buckets on the dashboard card.
    supabase
      .from("user_dividends")
      .select("paid_on, amount, currency, wrapper")
      .gte("paid_on", calendarSince)
      .order("paid_on", { ascending: true })
      .returns<{ paid_on: string; amount: number; currency: string; wrapper: string }[]>(),
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
  // latestYieldRes is sorted newest-first across all observations of every
  // ticker; first row per ticker is the latest. Maps to TickerFundamentals
  // alongside the equity_scores fundamentals below.
  const latestYieldByTicker = new Map<string, number | null>();
  for (const r of latestYieldRes.data ?? []) {
    if (!latestYieldByTicker.has(r.ticker)) {
      latestYieldByTicker.set(r.ticker, r.current_yield != null ? Number(r.current_yield) : null);
    }
  }

  const fundamentalsByTicker: Record<string, TickerFundamentals> = {};
  for (const score of scoresRes.data ?? []) {
    scoresByTicker[score.ticker] = buildHoldingScore({
      score,
      priorHistory: priorByTicker.get(score.ticker) ?? null,
      overrides: overridesByTicker.get(score.ticker) ?? [],
      now,
      sensitivity,
    });
    fundamentalsByTicker[score.ticker] = {
      sector: score.sector,
      forwardPe: score.forward_pe != null ? Number(score.forward_pe) : null,
      payoutRatio: score.payout_ratio != null ? Number(score.payout_ratio) : null,
      dividendYield: latestYieldByTicker.get(score.ticker) ?? null,
    };
  }

  // Opt-in score lens: re-aggregate the Buy/Quality score from persisted
  // signals using the user's category weights. Trim/Risk are left untouched.
  if (lens && prefs) {
    const weights = categoryWeightsFor(prefs);
    const signalsByTicker = await loadBuySignals(tickers);
    for (const t of Object.keys(scoresByTicker)) {
      const sig = signalsByTicker[t];
      if (sig) scoresByTicker[t] = { ...scoresByTicker[t], buy: reaggregateBuyScore(sig, weights) };
    }
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

  const todayIso = now.toISOString().slice(0, 10);
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
    sectorsToAvoid: prefs?.sectors_to_avoid ?? [],
    today: todayIso,
    windowDays: 5,
  });

  const nextDividend = pickNextDividend(exDivByTicker, todayIso);

  // Income calendar payload (Pro). Reuses scoresRes' next_ex_div_* columns,
  // ratesToGbp, and allHoldings; only the user_dividends fetch is new.
  // Currency heuristic matches build-card: .L => GBp, else USD.
  const calendarExDivByTicker: Record<string, IncomeCalendarExDiv> = {};
  for (const row of scoresRes.data ?? []) {
    if (row.next_ex_div_date) {
      calendarExDivByTicker[row.ticker] = {
        ex_date: row.next_ex_div_date,
        pay_date: row.next_ex_div_pay_date,
        amount: row.next_ex_div_amount ?? 0,
        currency: row.ticker.toUpperCase().endsWith(".L") ? "GBp" : "USD",
      };
    }
  }

  const incomeCalendar = buildIncomeCalendar({
    userDividends: (userDividendsForCalendarRes.data ?? []).map((d) => ({
      paid_on: d.paid_on,
      amount: Number(d.amount),
      currency: d.currency,
      wrapper: d.wrapper as never,
    })),
    holdings: allHoldings.map((h) => ({
      ticker: h.ticker,
      quantity: Number(h.quantity),
      wrapper: h.wrapper as never,
      created_at: h.created_at,
    })),
    exDivByTicker: calendarExDivByTicker,
    ratesToGbp,
    now,
    locale: "uk",
  });

  return {
    scoresByTicker,
    flagged,
    concentration,
    reinvestCard,
    weightByTicker,
    fundamentalsByTicker,
    nextDividend,
    incomeCalendar,
  };
}

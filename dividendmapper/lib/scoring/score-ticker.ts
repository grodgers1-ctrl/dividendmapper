// Shared per-ticker scoring path. Used by BOTH the nightly cron
// (app/api/internal/refresh-equity-scores) and the on-demand refresh endpoint
// (app/api/portfolio/refresh-scores) so the two never drift. Imports FMP via
// @/lib/scoring/fmp-client so existing route tests' mock boundary still applies.

import { type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  getProfile,
  getRatiosTtm,
  getRatiosQuarterly,
  getDividends,
  getIncomeStatementQuarterly,
  getCashFlowStatementQuarterly,
  getBalanceSheetStatementQuarterly,
  getKeyMetricsTtm,
  getKeyMetricsQuarterly,
  getAnalystEstimates,
  getDcf,
  getSma,
  getRsi,
  getHistoricalEod,
  getPriceTargetConsensus,
  getGradesHistorical,
  getInsiderTrades,
  type FmpCalendarDividend,
} from "@/lib/scoring/fmp-client";
import { assembleScoreInputs, extractCurrentPriceCurrency, type RawFmpBundle, type PriorHistory } from "@/lib/scoring/assemble-inputs";
import { computeBuyScore } from "@/lib/scoring/compute-buy-score";
import { computeTrimScore } from "@/lib/scoring/compute-trim-score";
import { computeDividendCagr5y } from "@/lib/scoring/dividend-cagr";
import { computeRiskScore } from "@/lib/scoring/compute-risk-score";
import type { SignalRecord } from "@/lib/scoring/compute-buy-score";
import { runWithConcurrency } from "@/lib/concurrency";
import { nextUpcomingDividend } from "@/lib/scoring/next-dividend";
import {
  detectCadence,
  computeGrowthRate,
  projectDividends,
  type HistoricalPayment,
  type ProjectedPayment,
} from "@/lib/scoring/project-dividends";
import { inferExDivNativeCurrency } from "@/lib/portfolio/ex-div-currency";

// FMP's per-minute quota is generous (~750/min on Premium) but it enforces a
// burst/concurrency guard. We never fan out more than FMP_CONCURRENCY requests
// at once per ticker. Env-tunable without code changes.
const FMP_CONCURRENCY = Number(process.env.FMP_CONCURRENCY) || 5;

export function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// JSONB consumer (page layer) reads snake_case keys. The lib uses camelCase
// internally; this transformer is the only place the two meet.
export function toProjectionJsonbRow(p: ProjectedPayment): {
  ex_date: string;
  pay_date: string;
  per_share_amount: number;
  currency: string;
  confidence: string;
} {
  return {
    ex_date: p.exDate,
    pay_date: p.payDate,
    per_share_amount: p.perShareAmount,
    currency: p.currency,
    confidence: p.confidence,
  };
}

export async function fetchTickerBundle(
  symbol: string,
  calendar: FmpCalendarDividend[],
): Promise<RawFmpBundle> {
  const from5y = isoDateOffset(-5 * 365);
  const today = isoDateOffset(0);
  // Bounded-concurrency fan-out (order preserved) instead of a 17-wide
  // Promise.all burst, to avoid tripping FMP's concurrency guard.
  const [
    profile,
    ratiosTtm,
    ratiosQuarterly,
    dividends,
    incomeQuarterly,
    cashflowQuarterly,
    balanceQuarterly,
    keyMetricsTtm,
    keyMetricsQuarterly,
    analystEstimates,
    dcf,
    sma,
    rsi,
    historicalEod,
    priceTarget,
    gradesHistorical,
    insiderTrades,
  ] = (await runWithConcurrency<unknown>(
    [
      () => getProfile(symbol),
      () => getRatiosTtm(symbol),
      () => getRatiosQuarterly(symbol, 20),
      () => getDividends(symbol, 24),
      () => getIncomeStatementQuarterly(symbol, 8),
      () => getCashFlowStatementQuarterly(symbol, 8),
      () => getBalanceSheetStatementQuarterly(symbol, 8),
      () => getKeyMetricsTtm(symbol),
      () => getKeyMetricsQuarterly(symbol, 8),
      () => getAnalystEstimates(symbol, "annual", 6),
      () => getDcf(symbol),
      () => getSma(symbol, 200, "1day"),
      () => getRsi(symbol, 14, "1day"),
      () => getHistoricalEod(symbol, from5y, today),
      () => getPriceTargetConsensus(symbol),
      () => getGradesHistorical(symbol, 6),
      () => getInsiderTrades(symbol, 100),
    ],
    FMP_CONCURRENCY,
  )) as [
    Awaited<ReturnType<typeof getProfile>>,
    Awaited<ReturnType<typeof getRatiosTtm>>,
    Awaited<ReturnType<typeof getRatiosQuarterly>>,
    Awaited<ReturnType<typeof getDividends>>,
    Awaited<ReturnType<typeof getIncomeStatementQuarterly>>,
    Awaited<ReturnType<typeof getCashFlowStatementQuarterly>>,
    Awaited<ReturnType<typeof getBalanceSheetStatementQuarterly>>,
    Awaited<ReturnType<typeof getKeyMetricsTtm>>,
    Awaited<ReturnType<typeof getKeyMetricsQuarterly>>,
    Awaited<ReturnType<typeof getAnalystEstimates>>,
    Awaited<ReturnType<typeof getDcf>>,
    Awaited<ReturnType<typeof getSma>>,
    Awaited<ReturnType<typeof getRsi>>,
    Awaited<ReturnType<typeof getHistoricalEod>>,
    Awaited<ReturnType<typeof getPriceTargetConsensus>>,
    Awaited<ReturnType<typeof getGradesHistorical>>,
    Awaited<ReturnType<typeof getInsiderTrades>>,
  ];
  return {
    profile: profile as RawFmpBundle["profile"],
    ratiosTtm: ratiosTtm as RawFmpBundle["ratiosTtm"],
    ratiosQuarterly,
    dividends: dividends as RawFmpBundle["dividends"],
    incomeQuarterly,
    cashflowQuarterly,
    balanceQuarterly,
    keyMetricsTtm,
    keyMetricsQuarterly,
    analystEstimates,
    dcf: dcf as RawFmpBundle["dcf"],
    sma,
    rsi,
    historicalEod: historicalEod as RawFmpBundle["historicalEod"],
    priceTarget: priceTarget as RawFmpBundle["priceTarget"],
    gradesHistorical: gradesHistorical as RawFmpBundle["gradesHistorical"],
    insiderTrades: insiderTrades as RawFmpBundle["insiderTrades"],
    dividendsCalendar: calendar,
  };
}

// Best-effort: prior R1 points + eps_avg series for cooldown / cold-start. Any
// failure (e.g. first run, no rows) degrades gracefully to empty history.
export async function loadPriorHistory(admin: SupabaseClient, ticker: string): Promise<PriorHistory> {
  const out: PriorHistory = { r1: [], epsAvg: [] };
  try {
    const { data: hist } = await admin
      .from("equity_score_history")
      .select("observed_at, eps_avg")
      .eq("ticker", ticker)
      .order("observed_at", { ascending: false })
      .limit(30);
    if (Array.isArray(hist)) {
      out.epsAvg = hist.map((h: { observed_at: string; eps_avg: number | null }) => ({
        date: h.observed_at,
        eps_avg: h.eps_avg,
      }));
    }
    const { data: sig } = await admin
      .from("equity_score_signals")
      .select("observed_at, raw_points")
      .eq("ticker", ticker)
      .eq("score_type", "risk")
      .eq("signal_code", "R1")
      .order("observed_at", { ascending: false })
      .limit(30);
    if (Array.isArray(sig)) {
      out.r1 = sig.map((s: { observed_at: string; raw_points: number | null }) => ({
        date: s.observed_at,
        r1Points: s.raw_points ?? 0,
      }));
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { ticker, stage: "loadPriorHistory" } });
  }
  return out;
}

export function topSignalRows(
  ticker: string,
  scoreType: "buy" | "trim" | "risk",
  signals: SignalRecord[],
  observedAt: string,
) {
  return [...signals]
    .map((s) => ({
      ticker,
      score_type: scoreType,
      signal_code: s.code,
      raw_score: scoreType === "risk" ? null : s.score,
      raw_points: scoreType === "risk" ? s.score : null,
      weight: scoreType === "risk" ? null : Number(s.effectiveWeight.toFixed(2)),
      contribution: Number(
        ((s.score ?? 0) * (scoreType === "risk" ? 1 : s.effectiveWeight)).toFixed(2),
      ),
      human_label: s.humanLabel || s.code,
      observed_at: observedAt,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5);
}

// Score ONE ticker and persist it (equity_scores + equity_score_history +
// equity_score_signals). Throws on a hard error so the caller can count +
// Sentry-capture per ticker without aborting a batch.
export async function scoreTicker(
  admin: SupabaseClient,
  ticker: string,
  calendar: FmpCalendarDividend[],
  today: string,
): Promise<void> {
  const bundle = await fetchTickerBundle(ticker, calendar);
  const history = await loadPriorHistory(admin, ticker);
  const assembled = assembleScoreInputs(ticker, bundle, history);

  const buy = computeBuyScore(assembled.buy);
  const trim = computeTrimScore(assembled.trim);
  const risk = computeRiskScore(assembled.risk);

  const dataQuality = assembled.meta.dataQualityUk
    ? "degraded_uk"
    : risk.dataQuality === "sparse"
      ? "sparse"
      : "full";

  // Persist this ticker's soonest upcoming ex-dividend from the already-fetched
  // market-wide calendar. Additive metadata only — none of the score fields
  // depend on or change because of this.
  const nextDiv = nextUpcomingDividend(calendar, ticker, today);

  // Surfaced on the per-ticker FundamentalsCard. All five are derived from the
  // same bundle the signals already consume — purely additive persistence.
  const forwardPe =
    assembled.buy.a2.forwardPe > 0 ? assembled.buy.a2.forwardPe : null;
  // Trailing TTM P/E direct from FMP. Avoids the page deriving P/E from
  // current_price / eps_avg — eps_avg holds forward EPS (R4 input) so the
  // derivation collapses to forward P/E on US tickers and is unit-mismatched
  // (pence price ÷ £ EPS) on .L tickers. priceToEarningsRatioTTM is the
  // canonical field; peRatioTTM is a legacy alias on some endpoints.
  const trailingPeRaw =
    (bundle.ratiosTtm[0] as { priceToEarningsRatioTTM?: number; peRatioTTM?: number } | undefined)
      ?.priceToEarningsRatioTTM ??
    (bundle.ratiosTtm[0] as { priceToEarningsRatioTTM?: number; peRatioTTM?: number } | undefined)
      ?.peRatioTTM ??
    null;
  const trailingPe =
    trailingPeRaw !== null &&
    Number.isFinite(trailingPeRaw) &&
    trailingPeRaw > 0
      ? trailingPeRaw
      : null;
  const payoutRatio =
    assembled.risk.r3.payoutRatio > 0 ? assembled.risk.r3.payoutRatio : null;
  const fcfCoverage =
    assembled.buy.fcfTtm != null && assembled.buy.dividendsPaidTtm > 0
      ? assembled.buy.fcfTtm / assembled.buy.dividendsPaidTtm
      : null;
  const dividendCagr5y = computeDividendCagr5y(bundle.dividends, new Date(today));
  const sector = assembled.meta.sector ?? null;

  // Calendar v2 / Slice B: per-ticker projection cache. Forward = next 12mo
  // of expected payments at the detected cadence (growth-adjusted); backward
  // = the past 12mo of same-cadence anchors that the page layer will gate
  // against each user's holdings.created_at floor. quantity=1 here so the
  // cache is per-share; the page multiplies by the user's actual holding.
  const projectionTodayDate = new Date(`${today}T00:00:00Z`);
  const historicalPayments: HistoricalPayment[] = bundle.dividends.map((d) => ({
    exDate: d.date,
    amount: d.dividend,
  }));
  const projectedCadence = detectCadence(historicalPayments);
  const projectedGrowthRate = computeGrowthRate(historicalPayments);
  const projectionCurrency = inferExDivNativeCurrency(ticker);
  const forwardProj = projectDividends({
    ticker,
    historicalPayments,
    holding: { quantity: 1, createdAt: null },
    today: projectionTodayDate,
    direction: "forward",
    currency: projectionCurrency,
  });
  const historicalProj = projectDividends({
    ticker,
    historicalPayments,
    holding: { quantity: 1, createdAt: null },
    today: projectionTodayDate,
    direction: "backward",
    currency: projectionCurrency,
  });

  const { error: scoresErr } = await admin.from("equity_scores").upsert(
    {
      ticker,
      name: bundle.profile[0]?.companyName ?? null,
      buy_score: buy.score,
      buy_quality_gate_passed: buy.qualityGatePassed,
      buy_failed_gates: buy.failedGates,
      trim_score: trim.score,
      risk_score: risk.score,
      ticker_market: assembled.meta.isUs ? "US" : "LSE",
      data_quality: dataQuality,
      sector,
      forward_pe: forwardPe,
      trailing_pe: trailingPe,
      payout_ratio: payoutRatio,
      fcf_coverage: fcfCoverage,
      dividend_cagr_5y: dividendCagr5y,
      next_ex_div_date: nextDiv?.date ?? null,
      next_ex_div_amount: nextDiv?.dividend ?? null,
      next_ex_div_pay_date:
        typeof nextDiv?.paymentDate === "string" && nextDiv.paymentDate !== ""
          ? nextDiv.paymentDate
          : null,
      projected_next_12m_payments: forwardProj.map(toProjectionJsonbRow),
      projected_historical_12m_payments: historicalProj.map(toProjectionJsonbRow),
      projected_cadence: projectedCadence,
      projected_growth_rate: projectedGrowthRate,
      projected_at: new Date().toISOString(),
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ticker" },
  );
  if (scoresErr) throw scoresErr;

  const { error: histErr } = await admin.from("equity_score_history").upsert(
    {
      ticker,
      observed_at: today,
      buy_score: buy.score,
      trim_score: trim.score,
      risk_score: risk.score,
      current_price: assembled.buy.b1.currentPrice || null,
      current_price_currency: extractCurrentPriceCurrency(bundle),
      current_yield: assembled.buy.a1.todayYield || null,
      dividend_per_share: assembled.dividendPerShareTtm || null,
      eps_avg: assembled.risk.r4.currentEpsAvg || null,
      net_debt_to_ebitda: assembled.risk.r5.currentNetDebtToEbitda || null,
      interest_coverage: assembled.risk.r6.currentInterestCoverage || null,
    },
    { onConflict: "ticker,observed_at" },
  );
  if (histErr) throw histErr;

  const signalRows = [
    ...topSignalRows(ticker, "buy", buy.signals, today),
    ...topSignalRows(ticker, "trim", trim.signals, today),
    ...topSignalRows(ticker, "risk", risk.signals, today),
  ];
  if (signalRows.length) {
    const { error: sigErr } = await admin
      .from("equity_score_signals")
      .upsert(signalRows, { onConflict: "ticker,score_type,signal_code,observed_at" });
    if (sigErr) throw sigErr;
  }
}

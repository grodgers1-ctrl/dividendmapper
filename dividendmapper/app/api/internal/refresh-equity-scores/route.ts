// Nightly cron for Phase 2.75 scoring. For each unique holdings ticker it pulls
// the full FMP data bundle, assembles the Buy/Trim/Risk inputs, runs the three
// score composers, and persists:
//   • equity_scores            — latest score per ticker (public-read)
//   • equity_score_history     — daily snapshot + the inputs R1/R4/R5/R6 read back
//   • equity_score_signals     — top-5 signal contributions per score type (drawer)
//
// Auth: Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends it). Per-ticker
// failures are caught + Sentry-captured but never abort the run.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  getDividendsCalendar,
  type FmpCalendarDividend,
} from "@/lib/scoring/fmp-client";
import { assembleScoreInputs, type RawFmpBundle, type PriorHistory } from "@/lib/scoring/assemble-inputs";
import { computeBuyScore } from "@/lib/scoring/compute-buy-score";
import { computeTrimScore } from "@/lib/scoring/compute-trim-score";
import { computeRiskScore } from "@/lib/scoring/compute-risk-score";
import type { SignalRecord } from "@/lib/scoring/compute-buy-score";
import { runWithConcurrency } from "@/lib/concurrency";
import { nextUpcomingDividend } from "@/lib/scoring/next-dividend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// FMP's per-minute quota is generous (~750/min on Premium) but it enforces a
// burst/concurrency guard. We never fan out more than FMP_CONCURRENCY requests
// at once per ticker, and pad FMP_TICKER_PAD_MS between tickers, to stay well
// clear of it. Both env-tunable without code changes; pad is 0 under test.
const FMP_CONCURRENCY = Number(process.env.FMP_CONCURRENCY) || 5;
const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.FMP_TICKER_PAD_MS) || 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function fetchTickerBundle(
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
async function loadPriorHistory(supabase: SupabaseClient, ticker: string): Promise<PriorHistory> {
  const out: PriorHistory = { r1: [], epsAvg: [] };
  try {
    const { data: hist } = await supabase
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
    const { data: sig } = await supabase
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

function topSignalRows(
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

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-equity-scores] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refresh-equity-scores] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const today = isoDateOffset(0);

  const { data: rows, error: tickersErr } = (await supabase.from("holdings").select("ticker")) as {
    data: { ticker: string }[] | null;
    error: unknown;
  };
  if (tickersErr) {
    Sentry.captureException(tickersErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const uniqueTickers = Array.from(new Set((rows ?? []).map((r) => r.ticker))).sort();

  // One market-wide dividends-calendar pull serves every ticker's D2 lookup.
  let calendar: FmpCalendarDividend[] = [];
  try {
    calendar = await getDividendsCalendar(today, isoDateOffset(90));
  } catch (err) {
    Sentry.captureException(err, { extra: { stage: "dividends-calendar" } });
  }

  let successfulTickerCount = 0;
  let failedTickerCount = 0;

  for (let t = 0; t < uniqueTickers.length; t++) {
    const ticker = uniqueTickers[t];
    if (t > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      const bundle = await fetchTickerBundle(ticker, calendar);
      const history = await loadPriorHistory(supabase, ticker);
      const assembled = assembleScoreInputs(ticker, bundle, history);

      const buy = computeBuyScore(assembled.buy);
      const trim = computeTrimScore(assembled.trim);
      const risk = computeRiskScore(assembled.risk);

      const dataQuality = assembled.meta.dataQualityUk
        ? "degraded_uk"
        : risk.dataQuality === "sparse"
          ? "sparse"
          : "full";

      // Day 6B: persist this ticker's soonest upcoming ex-dividend from the
      // already-fetched market-wide calendar. Additive metadata only — none of
      // the score fields above depend on or change because of this.
      const nextDiv = nextUpcomingDividend(calendar, ticker, today);

      const { error: scoresErr } = await supabase.from("equity_scores").upsert(
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
          next_ex_div_date: nextDiv?.date ?? null,
          next_ex_div_amount: nextDiv?.dividend ?? null,
          next_ex_div_pay_date:
            typeof nextDiv?.paymentDate === "string" && nextDiv.paymentDate !== ""
              ? nextDiv.paymentDate
              : null,
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ticker" },
      );
      if (scoresErr) throw scoresErr;

      const { error: histErr } = await supabase.from("equity_score_history").upsert(
        {
          ticker,
          observed_at: today,
          buy_score: buy.score,
          trim_score: trim.score,
          risk_score: risk.score,
          current_price: assembled.buy.b1.currentPrice || null,
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
        const { error: sigErr } = await supabase
          .from("equity_score_signals")
          .upsert(signalRows, { onConflict: "ticker,score_type,signal_code,observed_at" });
        if (sigErr) throw sigErr;
      }

      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-equity-scores] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
  }

  return NextResponse.json({
    ok: true,
    tickerCount: uniqueTickers.length,
    successfulTickerCount,
    failedTickerCount,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

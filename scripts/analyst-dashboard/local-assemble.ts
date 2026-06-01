// Derives the per-signal input shapes (A1..D2, T-A1..T-C2, R1..R7, quality-gate)
// directly from a cached FMP bundle. This is a fork of dividendmapper/lib/scoring/
// assemble-inputs.ts adapted to: (a) accept the partial cache (no ratiosTtm /
// keyMetrics / DCF / SMA / RSI / priceTarget / dividendsCalendar arrays), and
// (b) consume grades.json events directly (the prod path needs FmpGradeSnapshot
// rollups; the cache already stores events).
//
// Anything we can't derive is passed through as null/0/[] so the per-signal
// compute functions return N/A and the redistribution math collapses gracefully.

import { classifySector, type Sector } from "../../dividendmapper/lib/scoring/sector";
import { detectDividendCut } from "../../dividendmapper/lib/scoring/dividend-cut";
import type { ComputeBuyScoreInputs } from "../../dividendmapper/lib/scoring/compute-buy-score";
import type { ComputeTrimScoreInputs } from "../../dividendmapper/lib/scoring/compute-trim-score";
import type { ComputeRiskScoreInputs } from "../../dividendmapper/lib/scoring/compute-risk-score";
import type { GradeChange } from "../../dividendmapper/lib/scoring/signals/c2-net-upgrades";
import type { InsiderTrade } from "../../dividendmapper/lib/scoring/signals/c3-insider-buying";
import type { CacheBundle } from "./cache-loader";

type Row = Record<string, unknown>;

export interface PreparedInputs {
  buy: ComputeBuyScoreInputs;
  trim: ComputeTrimScoreInputs;
  risk: ComputeRiskScoreInputs;
  meta: { isUs: boolean; sector: Sector; companyName: string };
}

function num(row: Row | undefined, ...names: string[]): number | null {
  if (!row) return null;
  for (const n of names) {
    const v = row[n];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function sumFirstN(rows: Row[], n: number, ...names: string[]): number {
  let total = 0;
  for (const row of rows.slice(0, n)) {
    const v = num(row, ...names);
    if (v != null) total += v;
  }
  return total;
}

function latestClose(bundle: CacheBundle): number {
  return num(bundle.historicalEod[0], "close") ?? 0;
}

function annualDividend(dividends: Row[]): number {
  return dividends.slice(0, 4).reduce((a, d) => {
    const v = num(d, "dividend");
    return a + (v ?? 0);
  }, 0);
}

function buildDailyYields(bundle: CacheBundle, annualDiv: number): number[] {
  if (annualDiv <= 0) return [];
  const out: number[] = [];
  for (const bar of bundle.historicalEod) {
    const close = num(bar, "close");
    if (close && close > 0) out.push(annualDiv / close);
  }
  return out;
}

function high52w(bundle: CacheBundle): number {
  const highs: number[] = [];
  for (const bar of bundle.historicalEod.slice(0, 252)) {
    const h = num(bar, "high");
    if (h != null) highs.push(h);
  }
  return highs.length ? Math.max(...highs) : 0;
}

// 200-day simple moving average. Cache has no /technical-indicator/sma so we
// compute it locally — cheap, deterministic.
function sma200(bundle: CacheBundle): number {
  const closes: number[] = [];
  for (const bar of bundle.historicalEod.slice(0, 200)) {
    const c = num(bar, "close");
    if (c != null) closes.push(c);
  }
  if (closes.length < 200) return 0;
  return closes.reduce((a, c) => a + c, 0) / closes.length;
}

// Wilder's 14-day RSI on closes. Closes are latest-first in cache; the formula
// wants oldest-first, so we reverse the slice.
function rsi14(bundle: CacheBundle): number {
  const closes: number[] = [];
  for (const bar of bundle.historicalEod.slice(0, 30).reverse()) {
    const c = num(bar, "close");
    if (c != null) closes.push(c);
  }
  if (closes.length < 15) return -1;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (gains + losses === 0) return 50;
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function peHistory(_bundle: CacheBundle): number[] {
  // No ratios-quarterly in cache → A2/T-A2 returns N/A.
  return [];
}

// Cache grades events already match GradeChange (action: upgrade/downgrade/maintain).
function gradesToEvents(bundle: CacheBundle): GradeChange[] {
  return bundle.grades
    .map((g) => ({
      action: (typeof g.action === "string" ? g.action : "") as string,
      date: (typeof g.date === "string" ? g.date : "") as string,
    }))
    .filter((e) => e.date && /upgrade|downgrade/i.test(e.action));
}

function insiderToTrades(bundle: CacheBundle): InsiderTrade[] {
  return bundle.insiderTrades
    .map((t) => ({
      transactionType: typeof t.transactionType === "string" ? t.transactionType : "",
      securitiesTransacted: typeof t.securitiesTransacted === "number" ? t.securitiesTransacted : 0,
      price: typeof t.price === "number" ? t.price : 0,
      date: (typeof t.transactionDate === "string" ? t.transactionDate
        : typeof t.date === "string" ? t.date
        : "") as string,
    }))
    .filter((t) => t.date);
}

export function prepareInputs(bundle: CacheBundle, asOf: Date = new Date()): PreparedInputs {
  const symbol = bundle.ticker;
  const isUs = !/\.L$/i.test(symbol);
  const profile = bundle.profile[0] ?? {};
  const sector = classifySector(
    typeof profile.industry === "string" ? profile.industry : null,
  );

  const price = latestClose(bundle);
  const annualDiv = annualDividend(bundle.dividends);
  const todayYield = price > 0 ? annualDiv / price : 0;

  // Quality-gate fundamentals (TTM = last 4 quarters).
  const fcfTtm = sumFirstN(bundle.cashflowQuarterly, 4, "freeCashFlow");
  const dividendsPaidTtm = Math.abs(
    sumFirstN(
      bundle.cashflowQuarterly, 4,
      "commonDividendsPaid", "netDividendsPaid", "dividendsPaid", "commonStockDividendsPaid",
    ),
  );
  const ebitTtm = sumFirstN(
    bundle.incomeQuarterly, 4, "operatingIncome", "ebit", "incomeBeforeTax",
  );
  const interestExpenseTtm = Math.abs(
    sumFirstN(bundle.incomeQuarterly, 4, "interestExpense", "netInterestExpense"),
  );
  const netIncomeTtm = sumFirstN(
    bundle.incomeQuarterly, 4, "netIncome", "bottomLineNetIncome",
  );
  const marketCapUsd = num(profile, "mktCap", "marketCap") ?? 0;

  const sma = sma200(bundle);
  const rsi = rsi14(bundle);
  const trades = insiderToTrades(bundle);
  const events = gradesToEvents(bundle);

  const a1 = { todayYield, dailyYields: buildDailyYields(bundle, annualDiv) };
  const a2 = { forwardPe: -1, peHistory: peHistory(bundle) };
  const a3 = { intrinsic: 0, price, isUs };
  const b1 = { currentPrice: price, sma200: sma };
  const b2 = { currentPrice: price, high52w: high52w(bundle) };
  const b3 = { rsi14: rsi };
  const c1 = { currentPrice: price, targetMedian: null };
  const c2 = { events, asOf };
  const c3 = { symbol, trades, asOf };
  const d1 = { stockYield: todayYield, sectorMedianYield: null };
  const d2 = { nextExDivDate: null, asOf };

  const buy: ComputeBuyScoreInputs = {
    symbol, sector, isUs,
    fcfTtm, dividendsPaidTtm,
    dividendCutInLast5Years: detectDividendCut(
      bundle.dividends.map((d) => ({
        date: (d.date as string) ?? "",
        adjDividend: (d.adjDividend as number) ?? 0,
        dividend: (d.dividend as number) ?? 0,
      })),
      { asOf },
    ).isCut,
    ebitTtm, interestExpenseTtm, netIncomeTtm, marketCapUsd,
    a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2,
  };

  const trim: ComputeTrimScoreInputs = {
    symbol, isUs, sector,
    a1, a2, a3, b1, b2, b3, c1, c2,
  };

  const payoutRatio = netIncomeTtm > 0 ? dividendsPaidTtm / netIncomeTtm : 0;
  const coverageQuarters = bundle.cashflowQuarterly.slice(0, 6).map((q, i) => ({
    quarter: (typeof q.period === "string" ? q.period : `Q${i}`) as string,
    fcf: num(q, "freeCashFlow") ?? 0,
    dividendsPaid: Math.abs(
      num(q, "commonDividendsPaid", "netDividendsPaid", "dividendsPaid", "commonStockDividendsPaid") ?? 0,
    ),
  }));

  // Computed interest-coverage approximation from income statement.
  const intCovNow = interestExpenseTtm > 0 ? ebitTtm / interestExpenseTtm : 0;
  const olderEbit = sumFirstN(bundle.incomeQuarterly.slice(4), 4, "operatingIncome", "ebit");
  const olderIntExp = Math.abs(sumFirstN(bundle.incomeQuarterly.slice(4), 4, "interestExpense"));
  const intCovYearAgo = olderIntExp > 0 ? olderEbit / olderIntExp : intCovNow;

  const risk: ComputeRiskScoreInputs = {
    symbol,
    r1: {
      dividends: bundle.dividends.map((d) => ({
        date: (d.date as string) ?? "",
        adjDividend: (d.adjDividend as number) ?? 0,
        dividend: (d.dividend as number) ?? 0,
      })),
      pastRiskHistory: [],
      asOf,
    },
    r2: { quarters: coverageQuarters },
    r3: { payoutRatio, sector },
    r4: { currentEpsAvg: 0, pastEpsHistory: [], asOf },
    r5: { currentNetDebtToEbitda: 0, yearAgoNetDebtToEbitda: 0 },
    r6: { currentInterestCoverage: intCovNow, yearAgoInterestCoverage: intCovYearAgo },
    r7Trades: { trades },
  };

  const companyName =
    (typeof profile.companyName === "string" ? profile.companyName : symbol);

  return { buy, trim, risk, meta: { isUs, sector, companyName } };
}

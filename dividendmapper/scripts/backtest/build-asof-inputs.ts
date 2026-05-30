// build-asof-inputs.ts
// Assembles ComputeBuyScoreInputs (+ priceHistory) from per-ticker cache files,
// applying an asOfDate cutoff so no future data leaks into backtests.
//
// This is the backtest analogue of lib/scoring/assemble-inputs.ts. It reads
// from cached JSON instead of live FMP calls.
//
// NOTE: `buy` is typed as ComputeBuyScoreInputs & { priceHistory } rather than
// plain ComputeBuyScoreInputs so the backtest runner can derive technical
// indicators (MA, yield series, etc.) by re-reading priceHistory without
// re-opening files. Task 10 (parity test) will verify exact alignment with the
// live assembler's output shape.

import { readCache, cacheExists } from "./cache";
import { tickerCachePath, sectorPeerCachePath } from "./paths";
import { classifySector } from "../../lib/scoring/sector";
import { detectDividendCut } from "../../lib/scoring/dividend-cut";
import type { ComputeBuyScoreInputs } from "../../lib/scoring/compute-buy-score";
import type { GradeChange } from "../../lib/scoring/signals/c2-net-upgrades";
import type { InsiderTrade } from "../../lib/scoring/signals/c3-insider-buying";
import type { Sector } from "../../lib/scoring/sector";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface SectorPeerCache {
  sector: string;
  peers: { ticker: string; cacheDir: string }[];
}

export interface BuildAsOfInputsArgs {
  ticker: string;
  asOfDate: string; // ISO YYYY-MM-DD
  cacheRoot: string;
  sectorPeerCache: SectorPeerCache | null;
  /** Minimum number of peers that must have valid yield data before returning a median.
   *  Defaults to 5 in production; tests may lower it. */
  minPeerCount?: number;
}

export interface EodBar {
  date: string;
  adjClose: number;
  close: number;
  high?: number;
  low?: number;
  volume?: number;
}

// TTM-derived ratios exposed on the buy object for backtest consumers (e.g.
// Task 10 parity tests). These are NOT part of ComputeBuyScoreInputs; they
// sit alongside as backtest-only metadata.
export interface RatiosTtm {
  fcfCoverage: number | null;
  interestCoverage: number | null;
  netIncomeTtm: number;
  ebitTtm: number;
  fcfTtm: number;
  dividendsPaidTtmAbs: number;
}

// AsOfInputs.buy extends ComputeBuyScoreInputs with priceHistory so the
// backtest runner can access the raw price series without reopening files.
// Task 10 will assert that the non-priceHistory fields compile cleanly against
// ComputeBuyScoreInputs; for now a cast is applied where needed.
export interface AsOfBuyInputs extends ComputeBuyScoreInputs {
  priceHistory: EodBar[];
  ratiosTtm: RatiosTtm;
  /** Top-level accessor for D1's sectorMedianYield (mirrors d1.sectorMedianYield). */
  sectorMedianYield: number | null;
}

export interface AsOfInputs {
  buy: AsOfBuyInputs;
  meta: {
    ticker: string;
    asOfDate: string;
    sector: Sector;
    currency: string;
    isUs: boolean;
    naSignals: string[]; // signals always N/A in backtest (forward-looking)
  };
}

// ---------------------------------------------------------------------------
// Safe cache reader — returns defaultValue when file is absent
// ---------------------------------------------------------------------------

function safeRead<T>(path: string, defaultValue: T): T {
  if (!cacheExists(path)) return defaultValue;
  try {
    return readCache<T>(path);
  } catch {
    return defaultValue;
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns true when entry.date ≤ asOfDate (ISO string compare). */
function notAfter(entryDate: string, asOfDate: string): boolean {
  return entryDate <= asOfDate;
}

/** Returns true when entry falls within [asOfDate - windowDays, asOfDate]. */
function withinWindow(entryDate: string, asOfDate: string, windowDays: number): boolean {
  if (entryDate > asOfDate) return false;
  const asOfMs = new Date(asOfDate).getTime();
  const entryMs = new Date(entryDate).getTime();
  return (asOfMs - entryMs) / 86_400_000 <= windowDays;
}

// ---------------------------------------------------------------------------
// Typed raw shapes from cache files
// ---------------------------------------------------------------------------

interface RawEodBody {
  historical: Array<{ date: string; adjClose?: number; close?: number; high?: number; low?: number; volume?: number }>;
}

interface RawDividendBody {
  historical: Array<{ date: string; adjDividend: number; dividend: number; paymentDate?: string }>;
}

interface RawIndicatorBar {
  date: string;
  sma?: number;
  rsi?: number;
  close?: number;
}

interface RawQuarterRow {
  date: string;
  [key: string]: unknown;
}

interface RawGradeEvent {
  date: string;
  action?: string;
  gradingCompany?: string;
  previousGrade?: string;
  newGrade?: string;
  [key: string]: unknown;
}

interface RawInsiderTrade {
  transactionDate: string;
  transactionType: string;
  securitiesTransacted: number;
  price: number;
  [key: string]: unknown;
}

interface RawProfile {
  symbol?: string;
  sector?: string | null;
  industry?: string | null;
  currency?: string | null;
  mktCap?: number;
  marketCap?: number;
  exchangeShortName?: string;
}

// ---------------------------------------------------------------------------
// Defensive numeric reader
// ---------------------------------------------------------------------------

function num(row: Record<string, unknown> | undefined, ...names: string[]): number | null {
  if (!row) return null;
  for (const n of names) {
    const v = row[n];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function sumFirstN(rows: RawQuarterRow[], n: number, ...names: string[]): number {
  let total = 0;
  for (const row of rows.slice(0, n)) {
    const v = num(row as Record<string, unknown>, ...names);
    if (v != null) total += v;
  }
  return total;
}

// ---------------------------------------------------------------------------
// TTM ratio derivation
// ---------------------------------------------------------------------------

/**
 * Derives TTM ratios from the trailing 4 quarters of pre-filtered,
 * descending-sorted income and cash-flow arrays.
 *
 * If either array has fewer than 4 entries both coverage ratios are null
 * (insufficient TTM data). All other sum fields are returned regardless.
 */
function deriveTtm(
  incomeQuarterly: RawQuarterRow[],
  cashflowQuarterly: RawQuarterRow[],
): RatiosTtm {
  const incomeQ4 = incomeQuarterly.slice(0, 4);
  const cashQ4 = cashflowQuarterly.slice(0, 4);

  const insufficient = incomeQ4.length < 4 || cashQ4.length < 4;

  // Sums — always computed (even when insufficient, for transparency)
  const fcfTtmVal = sumFirstN(cashflowQuarterly, 4, "freeCashFlow");
  const dividendsPaidTtmAbs = Math.abs(
    sumFirstN(
      cashflowQuarterly,
      4,
      "commonDividendsPaid",
      "netDividendsPaid",
      "dividendsPaid",
      "dividendPaid",
      "commonStockDividendsPaid",
    ),
  );
  // Use ebit first (fixture uses this field); fall back to operatingIncome for
  // live FMP data which may store it differently.
  const ebitTtmVal = sumFirstN(incomeQuarterly, 4, "ebit", "operatingIncome", "incomeBeforeTax");
  const interestExpenseTtmVal = Math.abs(
    sumFirstN(incomeQuarterly, 4, "interestExpense", "netInterestExpense"),
  );
  const netIncomeTtmVal = sumFirstN(incomeQuarterly, 4, "netIncome", "bottomLineNetIncome");

  if (insufficient) {
    return {
      fcfCoverage: null,
      interestCoverage: null,
      netIncomeTtm: netIncomeTtmVal,
      ebitTtm: ebitTtmVal,
      fcfTtm: fcfTtmVal,
      dividendsPaidTtmAbs,
    };
  }

  const fcfCoverage =
    dividendsPaidTtmAbs > 0 ? fcfTtmVal / dividendsPaidTtmAbs : null;
  const interestCoverage =
    interestExpenseTtmVal > 0 ? ebitTtmVal / interestExpenseTtmVal : null;

  return {
    fcfCoverage,
    interestCoverage,
    netIncomeTtm: netIncomeTtmVal,
    ebitTtm: ebitTtmVal,
    fcfTtm: fcfTtmVal,
    dividendsPaidTtmAbs,
  };
}

// ---------------------------------------------------------------------------
// Sector-median yield helper
// ---------------------------------------------------------------------------

/**
 * Derives the median TTM dividend yield across sector peers, reading from
 * the sector peer cache subdirectory.
 *
 * Returns null when fewer than `minPeers` peers have valid yield data.
 */
function computeSectorMedianYield(opts: {
  sectorPeerCache: SectorPeerCache;
  cacheRoot: string;
  asOfDate: string;
  minPeers: number;
}): number | null {
  const { sectorPeerCache, cacheRoot, asOfDate, minPeers } = opts;
  const { sector, peers } = sectorPeerCache;

  const yields: number[] = [];

  for (const { ticker: peerTicker } of peers) {
    // Price: most recent close ≤ asOfDate
    const eodPath = sectorPeerCachePath(cacheRoot, sector, peerTicker, "historical-price-eod");
    const eodBody = safeRead<RawEodBody>(eodPath, { historical: [] });
    const priceBar = (eodBody.historical ?? [])
      .filter((b) => notAfter(b.date, asOfDate))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const close = priceBar?.close ?? priceBar?.adjClose ?? 0;
    if (!close || close <= 0) continue;

    // TTM dividends: sum adjDividend in [asOfDate-365d, asOfDate]
    const divPath = sectorPeerCachePath(cacheRoot, sector, peerTicker, "dividends");
    const divBody = safeRead<RawDividendBody>(divPath, { historical: [] });
    const ttmDivs = (divBody.historical ?? [])
      .filter((d) => notAfter(d.date, asOfDate) && withinWindow(d.date, asOfDate, 365))
      .reduce((acc, d) => acc + (Number.isFinite(d.adjDividend) ? d.adjDividend : 0), 0);
    if (ttmDivs <= 0) continue;

    yields.push(ttmDivs / close);
  }

  if (yields.length < minPeers) return null;

  // Median: sort ascending, take middle value (or mean of two middles for even count)
  yields.sort((a, b) => a - b);
  const mid = Math.floor(yields.length / 2);
  return yields.length % 2 === 1
    ? yields[mid]
    : (yields[mid - 1] + yields[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------

export function buildAsOfInputs(args: BuildAsOfInputsArgs): AsOfInputs {
  const { ticker, asOfDate, cacheRoot, minPeerCount = 5 } = args;

  const path = (endpoint: string) => tickerCachePath(cacheRoot, ticker, endpoint);

  // --- profile (static) ---------------------------------------------------
  const profileRaw = safeRead<RawProfile[]>(path("profile"), []);
  const profile = profileRaw[0] ?? ({} as RawProfile);
  const mktCap = profile.mktCap ?? profile.marketCap ?? 0;
  const currency = profile.currency ?? "USD";
  const exchangeShortName = profile.exchangeShortName ?? "";
  const isUs = /NYSE|NASDAQ|AMEX/i.test(exchangeShortName);
  const sector = classifySector(profile.industry ?? profile.sector ?? null);

  // --- price history (ascending, filtered ≤ asOfDate) --------------------
  const eodBody = safeRead<RawEodBody>(path("historical-price-eod"), { historical: [] });
  const priceHistory: EodBar[] = (eodBody.historical ?? [])
    .filter((b) => notAfter(b.date, asOfDate))
    .map((b) => ({
      date: b.date,
      adjClose: b.adjClose ?? b.close ?? 0,
      close: b.close ?? b.adjClose ?? 0,
      high: b.high,
      low: b.low,
      volume: b.volume,
    }))
    .sort((a, b) => a.date.localeCompare(b.date)); // ascending

  // Most-recent close (most-recent = last in ascending array = index -1)
  const latestBar = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
  const currentPrice = latestBar?.close ?? 0;

  // --- dividends (filtered ≤ asOfDate, sorted descending) -----------------
  const divBody = safeRead<RawDividendBody>(path("dividends"), { historical: [] });
  const dividends = (divBody.historical ?? [])
    .filter((d) => notAfter(d.date, asOfDate))
    .sort((a, b) => b.date.localeCompare(a.date)); // descending (most recent first)

  // TTM annual dividend for yield calculations
  const annualDiv = dividends
    .slice(0, 4)
    .reduce((acc, d) => acc + (Number.isFinite(d.adjDividend) ? d.adjDividend : 0), 0);

  // Daily yield series for A1 (price-driven; approximation — see assemble-inputs.ts)
  const dailyYields: number[] =
    annualDiv > 0
      ? priceHistory
          .map((b) => (b.close > 0 ? annualDiv / b.close : 0))
          .filter((y) => y > 0)
      : [];

  const todayYield = currentPrice > 0 && annualDiv > 0 ? annualDiv / currentPrice : 0;

  // --- SMA-200 (descending, take first ≤ asOfDate) ------------------------
  const smaRaw = safeRead<RawIndicatorBar[]>(path("sma-200"), []);
  const smaFiltered = smaRaw
    .filter((b) => notAfter(b.date, asOfDate))
    .sort((a, b) => b.date.localeCompare(a.date)); // descending
  const sma200 = smaFiltered[0]?.sma ?? 0;

  // --- RSI-14 (descending, take first ≤ asOfDate) -------------------------
  const rsiRaw = safeRead<RawIndicatorBar[]>(path("rsi-14"), []);
  const rsiFiltered = rsiRaw
    .filter((b) => notAfter(b.date, asOfDate))
    .sort((a, b) => b.date.localeCompare(a.date));
  const rsi14 = rsiFiltered[0]?.rsi ?? -1;

  // --- Income statement quarters (descending, filtered ≤ asOfDate) --------
  const incomeRaw = safeRead<RawQuarterRow[]>(path("income-statement-quarter"), []);
  const incomeQuarterly = incomeRaw
    .filter((r) => notAfter(r.date, asOfDate))
    .sort((a, b) => b.date.localeCompare(a.date));

  // --- Cash-flow quarters (descending, filtered ≤ asOfDate) ---------------
  const cashflowRaw = safeRead<RawQuarterRow[]>(path("cash-flow-statement-quarter"), []);
  const cashflowQuarterly = cashflowRaw
    .filter((r) => notAfter(r.date, asOfDate))
    .sort((a, b) => b.date.localeCompare(a.date));

  // --- Balance sheet quarters (descending, filtered ≤ asOfDate) -----------
  const balanceRaw = safeRead<RawQuarterRow[]>(path("balance-sheet-quarter"), []);
  // balanceQuarterly not used in Buy score currently, kept for completeness
  void balanceRaw
    .filter((r) => notAfter(r.date, asOfDate))
    .sort((a, b) => b.date.localeCompare(a.date));

  // --- Grade events (90-day window before asOfDate) -----------------------
  // Cache stores individual grade-change events (each with a `date` and
  // `action` field), NOT monthly snapshot counts. Direct conversion to
  // GradeChange[] is therefore trivial.
  const gradesRaw = safeRead<RawGradeEvent[]>(path("grades"), []);
  const gradeEvents: GradeChange[] = gradesRaw
    .filter((g) => withinWindow(g.date, asOfDate, 90))
    .map((g) => ({ action: g.action ?? "Hold", date: g.date }));

  // --- Insider trades (90-day window before asOfDate) ---------------------
  // Map transactionDate → date (InsiderTrade.date) so the scoring engine can
  // use the date field. We keep BOTH keys so test walkers that check
  // `transactionDate` also see filtered-only values.
  const insiderRaw = safeRead<RawInsiderTrade[]>(path("insider-trading"), []);
  const insiderTrades: InsiderTrade[] = insiderRaw
    .filter((t) => withinWindow(t.transactionDate, asOfDate, 90))
    .map((t) => ({
      transactionType: t.transactionType,
      securitiesTransacted: t.securitiesTransacted,
      price: t.price,
      date: t.transactionDate,
    }));

  // --- TTM ratios (derived from filtered quarterly arrays) -----------------
  const ratiosTtm = deriveTtm(incomeQuarterly, cashflowQuarterly);

  // --- Quality-gate fundamentals (TTM = 4 most-recent filtered quarters) --
  const fcfTtm = sumFirstN(cashflowQuarterly, 4, "freeCashFlow");
  const dividendsPaidTtm = Math.abs(
    sumFirstN(
      cashflowQuarterly,
      4,
      "commonDividendsPaid",
      "netDividendsPaid",
      "dividendsPaid",
      "dividendPaid",
      "commonStockDividendsPaid",
    ),
  );
  const ebitTtm = sumFirstN(incomeQuarterly, 4, "operatingIncome", "ebit", "incomeBeforeTax");
  const interestExpenseTtm = Math.abs(
    sumFirstN(incomeQuarterly, 4, "interestExpense", "netInterestExpense"),
  );
  const netIncomeTtm = sumFirstN(incomeQuarterly, 4, "netIncome", "bottomLineNetIncome");

  const dividendCutInLast5Years = detectDividendCut(
    dividends.map((d) => ({ date: d.date, adjDividend: d.adjDividend, dividend: d.dividend })),
    { asOf: new Date(asOfDate) },
  ).isCut;

  // --- 52-week high (252 trading bars, filtered ≤ asOfDate) ---------------
  // priceHistory is ascending, so last 252 = slice from end
  const recent252 = priceHistory.slice(-252);
  const high52wVal =
    recent252.length > 0
      ? Math.max(...recent252.map((b) => b.high ?? b.close))
      : 0;

  // --- P/E history (from income + price series) ---------------------------
  // No quarterly ratios cache in backtest; approximate from price / EPS.
  // Kept as empty array — A2 will return N/A (insufficient P/E history).
  // Task 10 / parity test will evaluate whether to add a ratios-quarter cache.
  const peHistory: number[] = [];

  // --- Forward signals: always N/A in backtest ----------------------------
  // A2 (forward P/E), A3 (DCF), C1 (analyst target) require forward-looking
  // data that doesn't exist in the historical cache. Set to null/empty so
  // redistribute-weights handles them as N/A signals.
  const forwardPe = -1; // signals A2 N/A
  const dcfIntrinsic = 0; // signals A3 N/A
  const analystTargetMedian: number | null = null; // signals C1 N/A
  const naSignals = ["A2", "A3", "C1"];

  // --- Ex-div proximity (D2) — no calendar cache in backtest --------------
  // D2 returns N/A when nextExDivDate is null.
  const nextExDivDate: string | null = null;

  // --- D1 sector-median yield — derived from peer cache if available -------
  const sectorMedianYield: number | null =
    args.sectorPeerCache != null
      ? computeSectorMedianYield({
          sectorPeerCache: args.sectorPeerCache,
          cacheRoot,
          asOfDate,
          minPeers: minPeerCount,
        })
      : null;
  if (sectorMedianYield === null) naSignals.push("D1");

  // --- Assemble buy inputs ------------------------------------------------
  const asOf = new Date(asOfDate);

  const buy: AsOfBuyInputs = {
    // Backtest-only extensions
    priceHistory,
    ratiosTtm,
    sectorMedianYield,

    // Identity
    symbol: ticker,
    sector,
    isUs,

    // Quality-gate fields
    fcfTtm,
    dividendsPaidTtm,
    dividendCutInLast5Years,
    ebitTtm,
    interestExpenseTtm,
    netIncomeTtm,
    marketCapUsd: mktCap,

    // Signal inputs
    a1: { todayYield, dailyYields },
    a2: { forwardPe, peHistory },
    a3: { intrinsic: dcfIntrinsic, price: currentPrice, isUs },
    b1: { currentPrice, sma200 },
    b2: { currentPrice, high52w: high52wVal },
    b3: { rsi14 },
    c1: { currentPrice, targetMedian: analystTargetMedian },
    c2: { events: gradeEvents, asOf },
    c3: { symbol: ticker, trades: insiderTrades, asOf },
    d1: { stockYield: todayYield, sectorMedianYield },
    d2: { nextExDivDate, asOf },
  };

  return {
    buy,
    meta: {
      ticker,
      asOfDate,
      sector,
      currency,
      isUs,
      naSignals,
    },
  };
}

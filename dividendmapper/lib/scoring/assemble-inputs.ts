// Transforms raw FMP responses (one bundle per ticker) into the Buy / Trim /
// Risk score-input shapes. This is the seam between "what FMP returns" and
// "what the pure scoring functions expect" — the place data-shape bugs hide, so
// field reads are defensive (multiple candidate names) and every approximation
// is commented.
//
// KNOWN APPROXIMATIONS / GAPS (verify/refine at first live cron trigger — Day 5
// is build-and-defer-deploy):
//   • A1 daily yield series uses current TTM dividend ÷ each historical close
//     (price-driven yield variation; ignores past dividend levels). Good enough
//     for a percentile rank dominated by price moves.
//   • A2 forward EPS picked from analyst-estimates nearest forward year.
//   • D1 sector-median yield has no cheap per-ticker FMP source → passed null
//     (D1 returns N/A, weight redistributes). Sector aggregation deferred.
//   • R4 reads past eps_avg from persisted history; we don't persist it yet, so
//     pastEpsHistory is [] → R4 stays cold-start "sparse" until a schema add.
//   • Unconfirmed field names (FMP burst-throttled probing): cash-flow
//     dividends-paid, income ebit/interest, analyst epsAvg, key-metrics
//     net-debt/EBITDA quarterly — read with fallbacks; confirm at first trigger.

import { classifySector, type Sector } from "./sector";
import { detectDividendCut } from "./dividend-cut";
import type { ComputeBuyScoreInputs } from "./compute-buy-score";
import type { ComputeTrimScoreInputs } from "./compute-trim-score";
import type { ComputeRiskScoreInputs } from "./compute-risk-score";
import type { GradeChange } from "./signals/c2-net-upgrades";
import type { InsiderTrade } from "./signals/c3-insider-buying";
import type {
  FmpProfile,
  FmpRatiosTtm,
  FmpDividend,
  FmpDcf,
  FmpIndicatorBar,
  FmpEodBar,
  FmpPriceTarget,
  FmpGradeSnapshot,
  FmpInsiderTrade,
  FmpCalendarDividend,
} from "./fmp-client";

type Row = Record<string, unknown>;

export interface RawFmpBundle {
  profile: FmpProfile[];
  ratiosTtm: FmpRatiosTtm[];
  ratiosQuarterly: Row[];
  dividends: FmpDividend[];
  incomeQuarterly: Row[];
  cashflowQuarterly: Row[];
  balanceQuarterly: Row[];
  keyMetricsTtm: Row[];
  keyMetricsQuarterly: Row[];
  analystEstimates: Row[];
  dcf: FmpDcf[];
  sma: FmpIndicatorBar[];
  rsi: FmpIndicatorBar[];
  historicalEod: FmpEodBar[];
  priceTarget: FmpPriceTarget[];
  gradesHistorical: FmpGradeSnapshot[];
  insiderTrades: FmpInsiderTrade[];
  dividendsCalendar: FmpCalendarDividend[];
}

export interface PriorHistory {
  // From equity_score_signals where score_type='risk' & signal_code='R1'.
  r1: { date: string; r1Points: number }[];
  // eps_avg snapshots — not persisted yet, so normally empty (R4 cold-start).
  epsAvg: { date: string; eps_avg: number | null }[];
}

export interface AssembledInputs {
  buy: ComputeBuyScoreInputs;
  trim: ComputeTrimScoreInputs;
  risk: ComputeRiskScoreInputs;
  /** Trailing-12-month dividend per share (native units) for income display. */
  dividendPerShareTtm: number;
  meta: { isUs: boolean; sector: Sector; dataQualityUk: boolean };
}

// --- defensive readers ------------------------------------------------------

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

// Like sumFirstN but returns null when NONE of the first n rows carried any of
// the named fields. This distinguishes "data unavailable" (FMP returned no
// rows / fields — common on UK names with fundamentals gaps) from a genuine
// summed zero, so the quality gates can SKIP rather than spuriously fail
// (a missing-income UK name was reading as a GATE_4 loss-maker).
function sumFirstNOrNull(rows: Row[], n: number, ...names: string[]): number | null {
  let total = 0;
  let found = false;
  for (const row of rows.slice(0, n)) {
    const v = num(row, ...names);
    if (v != null) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}

// --- sub-derivations --------------------------------------------------------

function latestClose(bundle: RawFmpBundle): number {
  return (
    num(bundle.historicalEod[0] as unknown as Row, "close") ??
    num(bundle.dcf[0] as unknown as Row, "Stock Price") ??
    0
  );
}

// Trailing-12-month dividend per share: sum of declared payments dated within
// the 365 days before asOf. Frequency-agnostic, so UK semi-annual payers (2/yr,
// e.g. SBRY.L) and US quarterly (4/yr) both yield a true annual figure. Feeds
// BOTH the persisted dividend_per_share (income display) AND the A1 yield
// signals (todayYield + the daily yield series) — the old fixed 4-payment
// annualDividend() over-counted UK semi-annual payers ~2x and is now removed.
export function trailingAnnualDividend(
  dividends: { date: string; dividend: number }[],
  asOf: Date,
): number {
  const cutoff = asOf.getTime() - 365 * 86_400_000;
  const now = asOf.getTime();
  let total = 0;
  for (const d of dividends) {
    const t = new Date(d.date).getTime();
    if (Number.isFinite(t) && t > cutoff && t <= now && Number.isFinite(d.dividend)) {
      total += d.dividend;
    }
  }
  return total;
}

function buildDailyYields(bundle: RawFmpBundle, annualDiv: number): number[] {
  if (annualDiv <= 0) return [];
  return bundle.historicalEod
    .map((bar) => (bar.close > 0 ? annualDiv / bar.close : 0))
    .filter((y) => y > 0);
}

function high52w(bundle: RawFmpBundle): number {
  const highs = bundle.historicalEod.slice(0, 252).map((b) => b.high).filter((h) => Number.isFinite(h));
  return highs.length ? Math.max(...highs) : 0;
}

function peHistory(bundle: RawFmpBundle): number[] {
  return bundle.ratiosQuarterly
    .map((r) => num(r, "priceToEarningsRatio", "priceEarningsRatio", "peRatio"))
    .filter((v): v is number => v != null && v > 0);
}

function forwardEps(bundle: RawFmpBundle, asOf: Date): number {
  // Pick the nearest forward fiscal-year estimate.
  const future = bundle.analystEstimates
    .filter((e) => typeof e.date === "string" && new Date(e.date as string) >= asOf)
    .sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
  const pick = future[0] ?? bundle.analystEstimates[0];
  return num(pick, "epsAvg", "estimatedEpsAvg", "eps") ?? 0;
}

// Trailing-12-month EPS (reporting currency), frequency-agnostic 365-day window.
// UK/EU companies report semi-annually, so a fixed 4-row sum would span ~2 years.
// Used only to scale the non-US forward P/E below.
function trailingEpsTtm(income: Row[], asOf: Date): number | null {
  const cutoff = asOf.getTime() - 365 * 86_400_000;
  const now = asOf.getTime();
  let total = 0;
  let found = false;
  for (const r of income) {
    const t = new Date((r.date as string) ?? "").getTime();
    const e = num(r, "eps", "epsDiluted");
    if (Number.isFinite(t) && t > cutoff && t <= now && e != null) {
      total += e;
      found = true;
    }
  }
  return found ? total : null;
}

// Forward P/E for the A2 signal. US: price and analyst EPS share a currency, so
// the direct price/forwardEps is correct. Non-US (.L): price is quoted in pence
// (GBX) while analyst EPS is in the company's reporting currency (e.g. EUR for
// Unilever), so price/forwardEps mixes units and is ~100x wrong. Instead scale
// FMP's stable TTM P/E by the unit-free trailing/forward EPS ratio (both EPS
// from the reporting-currency series):
//   peTTM x (trailingEps / fwdEps) = (price/trailingEps) x (trailingEps/fwdEps)
// which equals price/fwdEps in consistent units, without ever mixing GBX and the
// reporting currency. Falls back to -1 (A2 → N/A, weight redistributes) when the
// TTM P/E or trailing EPS is unavailable.
function forwardPeFor(
  bundle: RawFmpBundle,
  isUs: boolean,
  price: number,
  fwdEps: number,
  asOf: Date,
): number {
  if (fwdEps <= 0) return -1;
  if (isUs) return price > 0 ? price / fwdEps : -1;
  const peTtm = num(bundle.ratiosTtm[0] as unknown as Row, "priceToEarningsRatioTTM", "peRatioTTM");
  const trailingEps = trailingEpsTtm(bundle.incomeQuarterly, asOf);
  if (peTtm == null || peTtm <= 0 || trailingEps == null || trailingEps <= 0) return -1;
  return peTtm * (trailingEps / fwdEps);
}

// Convert monthly analyst-rating-count snapshots into directional grade-change
// events for C2/Trim-C2. We diff consecutive snapshots within the 90d window:
// each net "notch" of sentiment improvement emits an Upgrade event, each notch
// of deterioration a Downgrade. Net = ups − downs, magnitude = activity volume.
function gradesToEvents(snapshots: FmpGradeSnapshot[], asOf: Date): GradeChange[] {
  const bull = (s: FmpGradeSnapshot) =>
    (s.analystRatingsStrongBuy ?? 0) * 2 +
    (s.analystRatingsBuy ?? 0) -
    (s.analystRatingsSell ?? 0) -
    (s.analystRatingsStrongSell ?? 0) * 2;
  // latest first
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const events: GradeChange[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const newer = sorted[i];
    const older = sorted[i + 1];
    const delta = bull(newer) - bull(older);
    const action = delta > 0 ? "Upgrade" : "Downgrade";
    for (let k = 0; k < Math.abs(delta); k++) {
      events.push({ action, date: newer.date });
    }
  }
  void asOf; // window filtering happens inside C2
  return events;
}

function insiderToTrades(trades: FmpInsiderTrade[]): InsiderTrade[] {
  return trades.map((t) => ({
    transactionType: t.transactionType,
    securitiesTransacted: t.securitiesTransacted,
    price: t.price,
    date: (t.transactionDate as string) ?? (t.date as string),
  }));
}

function nextExDiv(symbol: string, calendar: FmpCalendarDividend[], asOf: Date): string | null {
  const upcoming = calendar
    .filter((c) => c.symbol === symbol && new Date(c.date) >= asOf)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0]?.date ?? null;
}

// --- main -------------------------------------------------------------------

export function assembleScoreInputs(
  symbol: string,
  bundle: RawFmpBundle,
  history: PriorHistory,
  asOf: Date = new Date(),
): AssembledInputs {
  const isUs = !/\.L$/i.test(symbol);
  const profile = bundle.profile[0];
  const sector = classifySector(profile?.industry ?? null);
  const profileRow = profile as unknown as Row;
  const isFundOrEtf = profileRow?.isEtf === true || profileRow?.isFund === true;

  const price = latestClose(bundle);
  const annualDiv = trailingAnnualDividend(bundle.dividends, asOf);
  const todayYield =
    bundle.ratiosTtm[0]?.dividendYieldTTM ?? (price > 0 ? annualDiv / price : 0);

  // Quality-gate / fundamentals (TTM = last 4 quarters). Use the null-aware
  // sum for the gate inputs so a fundamentals gap skips the gate instead of
  // spuriously failing it (see sumFirstNOrNull). dividendsPaidTtm stays a plain
  // sum: it is only a divisor (0 → coverage = +Infinity → GATE_1 passes).
  const fcfTtm = sumFirstNOrNull(bundle.cashflowQuarterly, 4, "freeCashFlow");
  const dividendsPaidTtm = Math.abs(
    sumFirstN(
      bundle.cashflowQuarterly,
      4,
      "commonDividendsPaid",
      "netDividendsPaid",
      "dividendsPaid",
      "commonStockDividendsPaid",
    ),
  );
  const ebitTtm = sumFirstNOrNull(bundle.incomeQuarterly, 4, "operatingIncome", "ebit", "incomeBeforeTax");
  const interestExpenseRaw = sumFirstNOrNull(
    bundle.incomeQuarterly,
    4,
    "interestExpense",
    "netInterestExpense",
  );
  const interestExpenseTtm = interestExpenseRaw === null ? null : Math.abs(interestExpenseRaw);
  const netIncomeTtm = sumFirstNOrNull(bundle.incomeQuarterly, 4, "netIncome", "bottomLineNetIncome");
  const marketCapUsd = num(profile as unknown as Row, "mktCap", "marketCap") ?? 0;

  const fwdEps = forwardEps(bundle, asOf);
  const forwardPe = forwardPeFor(bundle, isUs, price, fwdEps, asOf);

  const dcf = bundle.dcf[0];
  const sma200 = num(bundle.sma[0] as unknown as Row, "sma") ?? 0;
  const rsi14 = num(bundle.rsi[0] as unknown as Row, "rsi") ?? -1;
  const targetMedian = bundle.priceTarget[0]?.targetMedian ?? null;

  const trades = insiderToTrades(bundle.insiderTrades);
  const events = gradesToEvents(bundle.gradesHistorical, asOf);

  // Shared signal inputs (Buy + Trim consume the same A/B/C sub-inputs).
  const a1 = { todayYield, dailyYields: buildDailyYields(bundle, annualDiv) };
  const a2 = { forwardPe, peHistory: peHistory(bundle) };
  const a3 = { intrinsic: dcf?.dcf ?? 0, price: dcf?.["Stock Price"] ?? price, isUs };
  const b1 = { currentPrice: price, sma200 };
  const b2 = { currentPrice: price, high52w: high52w(bundle) };
  const b3 = { rsi14 };
  const c1 = { currentPrice: price, targetMedian };
  const c2 = { events, asOf };
  const c3 = { symbol, trades, asOf };
  const d1 = { stockYield: todayYield, sectorMedianYield: null };
  const d2 = { nextExDivDate: nextExDiv(symbol, bundle.dividendsCalendar, asOf), asOf };

  const buy: ComputeBuyScoreInputs = {
    symbol,
    sector,
    isUs,
    isFundOrEtf,
    fcfTtm,
    dividendsPaidTtm,
    dividendCutInLast5Years: detectDividendCut(bundle.dividends, { asOf }).isCut,
    ebitTtm,
    interestExpenseTtm,
    netIncomeTtm,
    marketCapUsd,
    a1,
    a2,
    a3,
    b1,
    b2,
    b3,
    c1,
    c2,
    c3,
    d1,
    d2,
  };

  const trim: ComputeTrimScoreInputs = {
    symbol,
    isUs,
    sector,
    a1,
    a2,
    a3,
    b1,
    b2,
    b3,
    c1,
    c2,
  };

  // Risk fundamentals.
  const payoutRatio =
    bundle.ratiosTtm[0]?.dividendPayoutRatioTTM ??
    num(bundle.ratiosQuarterly[0], "dividendPayoutRatio") ??
    0;

  const coverageQuarters = bundle.cashflowQuarterly.slice(0, 6).map((q, i) => ({
    quarter: (q.period as string) ?? `Q${i}`,
    fcf: num(q, "freeCashFlow") ?? 0,
    dividendsPaid: Math.abs(
      num(q, "commonDividendsPaid", "netDividendsPaid", "dividendsPaid", "commonStockDividendsPaid") ?? 0,
    ),
  }));

  const netDebtNow = num(bundle.keyMetricsTtm[0], "netDebtToEBITDATTM", "netDebtToEBITDA") ?? 0;
  const netDebtYearAgo = num(bundle.keyMetricsQuarterly[4], "netDebtToEBITDA", "netDebtToEBITDATTM") ?? netDebtNow;
  const intCovNow = num(bundle.ratiosQuarterly[0], "interestCoverageRatio", "interestCoverage") ?? 0;
  const intCovYearAgo =
    num(bundle.ratiosQuarterly[4], "interestCoverageRatio", "interestCoverage") ?? intCovNow;

  const risk: ComputeRiskScoreInputs = {
    symbol,
    r1: {
      dividends: bundle.dividends.map((d) => ({
        date: d.date,
        adjDividend: d.adjDividend,
        dividend: d.dividend,
      })),
      pastRiskHistory: history.r1,
      asOf,
    },
    r2: { quarters: coverageQuarters },
    r3: { payoutRatio, sector },
    r4: { currentEpsAvg: fwdEps, pastEpsHistory: history.epsAvg, asOf },
    r5: { currentNetDebtToEbitda: netDebtNow, yearAgoNetDebtToEbitda: netDebtYearAgo },
    r6: { currentInterestCoverage: intCovNow, yearAgoInterestCoverage: intCovYearAgo },
    r7Trades: { trades },
  };

  return {
    buy,
    trim,
    risk,
    dividendPerShareTtm: annualDiv,
    meta: { isUs, sector, dataQualityUk: !isUs },
  };
}

export function extractCurrentPriceCurrency(
  bundle: { profile: Array<{ currency?: string | null }> },
): string | null {
  const c = bundle.profile?.[0]?.currency;
  return typeof c === 'string' && c.length > 0 ? c : null;
}

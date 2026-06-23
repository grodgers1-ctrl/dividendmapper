// Phase 4 Sprint 2 Day 10 — Vehicle signal-input assembly.
// Pure transformation: raw rows (from Supabase + FMP) into the per-family
// VehicleSignalBundle that compute-vehicle-score dispatches to the 8 signal
// functions. Same seam as the equity engine's assemble-inputs.ts.
//
// Currency: callers pass `currency` from vehicle_universe; LSE tickers
// (currency=GBX) have prices and dividends already normalised to GBP by
// vehicle-fmp.ts. Per-share fundamentals reported by FMP in pence are NOT
// normalised at the storage layer (Sprint 1 stored bookValuePerShare via
// nav_per_share with normalisation, but raw income/balance rows still carry
// pence values). This module handles GBX→GBP for the per-share inputs it
// derives at scoring time.

import type { VehicleType, VehicleDividendRow } from "./vehicle-fmp";
import { propertyTypeFor } from "./signals/c_u1-property-focus";
import { geographicScopeFor } from "./signals/c_u2-geo-scope";
import type { VehicleQualityGateInputs } from "./vehicle-quality-gates";

export interface FundamentalsSnapshot {
  period_end: string;
  period_type: "quarterly" | "semi_annual" | "annual";
  nav_per_share: number | null;
  debt_total: number | null;
  equity_total: number | null;
  ebitda: number | null;
  interest_expense: number | null;
}

export interface PriceSnapshot {
  observed_at: string;
  close_price: number;
}

export interface SegmentationEntry {
  date: string;
  data: Record<string, number>;
}

export interface FinancialRow {
  date: string;
  netIncome?: number | null;
  depreciationAndAmortization?: number | null;
  weightedAverageShsOut?: number | null;
  netInvestmentIncome?: number | null;
  totalInvestmentIncome?: number | null;
  totalInterestIncome?: number | null;
  interestIncome?: number | null;
  totalOperatingExpenses?: number | null;
  operatingExpenses?: number | null;
  operatingIncome?: number | null;
  revenue?: number | null;
  totalAssets?: number | null;
  cashAndShortTermInvestments?: number | null;
  totalDebt?: number | null;
  ebitda?: number | null;
  interestExpense?: number | null;
  totalEquity?: number | null;
  dividendsPaid?: number | null;
  costOfRevenue?: number | null;
}

export interface RawVehicleData {
  ticker: string;
  vehicleType: VehicleType;
  subSector: string | null;
  currency: "USD" | "GBP" | "GBX";
  fundamentals: FundamentalsSnapshot[]; // date-asc
  prices: PriceSnapshot[];               // date-asc
  dividends: VehicleDividendRow[];       // date-desc (FMP convention)
  productSegmentation: SegmentationEntry[];
  geoSegmentation: SegmentationEntry[];
  rawIncomeStatements: FinancialRow[];   // date-desc (FMP convention)
  rawBalanceSheets: FinancialRow[];      // date-desc
  asOf: Date;
}

export interface VehicleSignalBundle {
  vehicleType: VehicleType;
  ticker: string;
  dataQuality: "full" | "partial" | "sparse";

  qS1: { dividends: VehicleDividendRow[]; asOf: Date };
  dS1: { currentPrice: number; navPerShare: number; ratioHistory: number[] };
  rS1: { dividends: VehicleDividendRow[]; excludeSpecials: boolean; asOf: Date };

  qR1?: { ttmDps: number; ttmFfoPerShare: number };
  qR2?: { totalDebt: number; cash: number; ttmEbitda: number };
  cR1?: { segmentShares: number[] };
  cR2?: { segmentShares: number[] };
  rR1?: { ttmEbitda: number; ttmInterestExpense: number };

  qB1?: { ttmNiiPerShare: number; ttmRegularDps: number };
  qB2?: { navPerShareHistory: { period_end: string; nav_per_share: number }[] };
  cB1?: { totalDebt: number; totalEquity: number };
  rB1?: {
    currentInterestIncome: number;
    currentDebtInvestments: number;
    priorInterestIncome: number;
    priorDebtInvestments: number;
  };
  rB2?: { dividends: VehicleDividendRow[]; asOf: Date };

  qU1?: { ttmNetRentalIncome: number; ttmTotalDividendsPaid: number };
  qU2?: { totalDebt: number; totalAssets: number };
  cU1?: { propertyType: string };
  cU2?: { geographicScope: string };
  rU1?: { ttmEbitda: number; ttmInterestExpense: number };

  gateInputs: VehicleQualityGateInputs;
}

// -------- helpers --------

function normaliseGbxPerShare(value: number, currency: string): number {
  return currency === "GBX" ? value / 100 : value;
}

function sumFirstN(
  rows: FinancialRow[],
  n: number,
  field: keyof FinancialRow,
): number | null {
  if (rows.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const row of rows.slice(0, n)) {
    const v = row[field];
    if (typeof v === "number" && Number.isFinite(v)) {
      total += v;
      count += 1;
    }
  }
  return count === 0 ? null : total;
}

function firstNumber(
  rows: FinancialRow[],
  fields: (keyof FinancialRow)[],
): number | null {
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  }
  return null;
}

function modalAmount(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  const counts = new Map<string, number>();
  for (const a of amounts) {
    const key = a.toFixed(4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let modeKey = "";
  let modeCount = 0;
  for (const [k, c] of counts) {
    if (c > modeCount) {
      modeCount = c;
      modeKey = k;
    }
  }
  return parseFloat(modeKey);
}

function trailingDividendTotal(
  dividends: VehicleDividendRow[],
  asOf: Date,
  monthsBack: number,
): number {
  const cutoff = new Date(asOf.getTime() - monthsBack * 30 * 24 * 3600 * 1000);
  let total = 0;
  for (const d of dividends) {
    const dt = new Date(d.ex_date + "T00:00:00Z");
    if (dt >= cutoff && dt <= asOf) total += d.dividend;
  }
  return total;
}

function modalDividendForYear(dividends: VehicleDividendRow[], year: number): number | null {
  const yearRows = dividends.filter((d) => d.ex_date.startsWith(String(year)));
  if (yearRows.length === 0) return null;
  return modalAmount(yearRows.map((r) => r.dividend));
}

function ttmRegularDps(
  dividends: VehicleDividendRow[],
  asOf: Date,
): number {
  // Sum trailing-12-month dividends excluding entries ≥ 1.5× the modal of
  // their calendar year. Same heuristic as r_s1-cut and r_b2-special-mix.
  const cutoff = new Date(asOf.getTime() - 365 * 24 * 3600 * 1000);
  const inWindow = dividends.filter((d) => {
    const dt = new Date(d.ex_date + "T00:00:00Z");
    return dt >= cutoff && dt <= asOf;
  });
  // Group within window by year for modal detection
  const byYear = new Map<number, VehicleDividendRow[]>();
  for (const d of inWindow) {
    const y = parseInt(d.ex_date.slice(0, 4), 10);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(d);
  }
  let total = 0;
  for (const [, rows] of byYear) {
    const modal = modalAmount(rows.map((r) => r.dividend));
    if (modal === null) continue;
    const threshold = modal * 1.5;
    for (const r of rows) {
      if (r.dividend < threshold) total += r.dividend;
    }
  }
  return total;
}

function hasDividendCutInLast5Years(
  dividends: VehicleDividendRow[],
  asOf: Date,
  excludeSpecials: boolean,
): boolean {
  const currentYear = asOf.getUTCFullYear();
  const lookbackStart = currentYear - 5;
  const source = excludeSpecials
    ? excludeSpecialsByYear(dividends)
    : dividends;
  const byYear = new Map<number, number[]>();
  for (const d of source) {
    const y = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(y) || y < lookbackStart || y >= currentYear) continue;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(d.dividend);
  }
  // Day 13 CAL-1: compare modal-amount per year × modal payment frequency
  // rather than raw sums. This:
  //   • neutralises stray 13th payments inflating one year's total
  //   • drops one-off catch-up amounts that escape the 1.5× modal filter
  //   • still flags genuine per-payment cuts (modal amount drops)
  // The "annualised modal rate" for a year = mode(amount) × mode(count
  // across the comparison window). When a year is structurally incomplete
  // (semi-annual UK REIT, year-just-started), the trailing-year guard below
  // drops it from the comparison.
  const yearRates = new Map<number, { modalAmount: number; count: number }>();
  for (const [year, amounts] of byYear) {
    const modal = modalAmount(amounts);
    if (modal === null) continue;
    yearRates.set(year, { modalAmount: modal, count: amounts.length });
  }
  let yearsAsc = Array.from(yearRates.keys()).sort((a, b) => a - b);
  if (yearsAsc.length >= 2) {
    const last = yearsAsc[yearsAsc.length - 1];
    const prev = yearsAsc[yearsAsc.length - 2];
    if (
      yearRates.get(prev)!.count > 0 &&
      yearRates.get(last)!.count / yearRates.get(prev)!.count < 0.8
    ) {
      yearsAsc = yearsAsc.slice(0, -1);
    }
  }
  // Reference frequency = modal count across the kept years.
  const counts = yearsAsc.map((y) => yearRates.get(y)!.count);
  const refCount = modalAmount(counts.map((c) => c));
  if (refCount === null || refCount === 0) return false;
  for (let i = 1; i < yearsAsc.length; i++) {
    const cur = yearRates.get(yearsAsc[i])!.modalAmount * refCount;
    const prev = yearRates.get(yearsAsc[i - 1])!.modalAmount * refCount;
    if (prev > 0 && cur / prev < 0.95) return true;
  }
  return false;
}

function excludeSpecialsByYear(dividends: VehicleDividendRow[]): VehicleDividendRow[] {
  const byYear = new Map<number, VehicleDividendRow[]>();
  for (const d of dividends) {
    const y = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(y)) continue;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(d);
  }
  const out: VehicleDividendRow[] = [];
  for (const [, rows] of byYear) {
    const modal = modalAmount(rows.map((r) => r.dividend));
    if (modal === null) continue;
    const threshold = modal * 1.5;
    for (const r of rows) {
      if (r.dividend < threshold) out.push(r);
    }
  }
  return out;
}

function priceNavRatioHistory(
  prices: PriceSnapshot[],
  fundamentals: FundamentalsSnapshot[],
): number[] {
  if (fundamentals.length === 0 || prices.length === 0) return [];
  const navObservations = fundamentals
    .filter((f) => typeof f.nav_per_share === "number" && f.nav_per_share! > 0)
    .map((f) => ({ date: f.period_end, nav: f.nav_per_share! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (navObservations.length === 0) return [];
  const out: number[] = [];
  let cursor = 0;
  for (const p of prices) {
    while (
      cursor + 1 < navObservations.length &&
      navObservations[cursor + 1].date <= p.observed_at
    ) {
      cursor += 1;
    }
    const nav = navObservations[cursor].nav;
    if (nav > 0) out.push(p.close_price / nav);
  }
  return out;
}

function segmentationShares(entry: SegmentationEntry | undefined): number[] {
  if (!entry) return [];
  const values = Object.values(entry.data).filter(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  ) as number[];
  if (values.length === 0) return [];
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return values.map((v) => v / total);
}

function latestSegmentation(rows: SegmentationEntry[]): SegmentationEntry | undefined {
  if (rows.length === 0) return undefined;
  return [...rows].sort((a, b) => b.date.localeCompare(a.date))[0];
}

// -------- per-family assembly --------

function assembleSharedSignals(
  raw: RawVehicleData,
  excludeSpecials: boolean,
): {
  qS1: VehicleSignalBundle["qS1"];
  dS1: VehicleSignalBundle["dS1"];
  rS1: VehicleSignalBundle["rS1"];
} {
  const latestPrice = raw.prices.length > 0
    ? raw.prices[raw.prices.length - 1].close_price
    : 0;
  const latestNav = (() => {
    for (let i = raw.fundamentals.length - 1; i >= 0; i--) {
      const v = raw.fundamentals[i].nav_per_share;
      if (typeof v === "number" && v > 0) return v;
    }
    return 0;
  })();
  return {
    qS1: { dividends: raw.dividends, asOf: raw.asOf },
    dS1: {
      currentPrice: latestPrice,
      navPerShare: latestNav,
      ratioHistory: priceNavRatioHistory(raw.prices, raw.fundamentals),
    },
    rS1: { dividends: raw.dividends, excludeSpecials, asOf: raw.asOf },
  };
}

function assembleUsReitInputs(raw: RawVehicleData): VehicleSignalBundle {
  const shared = assembleSharedSignals(raw, false);
  const inc = raw.rawIncomeStatements;
  const bal = raw.rawBalanceSheets;

  const ttmNetIncome = sumFirstN(inc, 4, "netIncome");
  const ttmDA = sumFirstN(inc, 4, "depreciationAndAmortization");
  const wgtAvgShs = firstNumber(inc, ["weightedAverageShsOut"]);
  const ttmFfoPerShare =
    ttmNetIncome !== null && ttmDA !== null && wgtAvgShs !== null && wgtAvgShs > 0
      ? (ttmNetIncome + ttmDA) / wgtAvgShs
      : null;
  const ttmDps = trailingDividendTotal(raw.dividends, raw.asOf, 12);
  const ttmEbitda = sumFirstN(inc, 4, "ebitda");
  const ttmInterestExpense = sumFirstN(inc, 4, "interestExpense");
  const totalDebt = firstNumber(bal, ["totalDebt"]);
  const cash = firstNumber(bal, ["cashAndShortTermInvestments"]);
  // Day 13 CAL-1: gate-input cut detection excludes specials so prior-year
  // supplementals don't inflate the baseline and create false cuts.
  const cuts = hasDividendCutInLast5Years(raw.dividends, raw.asOf, true);

  const productSeg = latestSegmentation(raw.productSegmentation);
  const geoSeg = latestSegmentation(raw.geoSegmentation);

  const cascaded: string[] = [];
  if (ttmFfoPerShare === null) cascaded.push("Q_R1");
  if (ttmEbitda === null || totalDebt === null || cash === null) cascaded.push("Q_R2");
  if (segmentationShares(productSeg).length === 0) cascaded.push("C_R1");
  if (segmentationShares(geoSeg).length === 0) cascaded.push("C_R2");
  if (ttmEbitda === null || ttmInterestExpense === null) cascaded.push("R_R1");
  if (raw.fundamentals.length === 0 || raw.prices.length === 0) cascaded.push("D_S1");

  return {
    vehicleType: "us_reit",
    ticker: raw.ticker,
    dataQuality:
      cascaded.length === 0 ? "full" : cascaded.length <= 2 ? "partial" : "sparse",
    qS1: shared.qS1,
    dS1: shared.dS1,
    rS1: shared.rS1,
    qR1:
      ttmFfoPerShare !== null
        ? { ttmDps, ttmFfoPerShare }
        : undefined,
    qR2:
      ttmEbitda !== null && totalDebt !== null && cash !== null
        ? { totalDebt, cash, ttmEbitda }
        : undefined,
    cR1: { segmentShares: segmentationShares(productSeg) },
    cR2: { segmentShares: segmentationShares(geoSeg) },
    rR1:
      ttmEbitda !== null && ttmInterestExpense !== null
        ? { ttmEbitda, ttmInterestExpense }
        : undefined,
    gateInputs: {
      vehicleType: "us_reit",
      subSector: raw.subSector,
      dividendCutInLast5Years: cuts,
      ttmDps,
      ttmFfoPerShare: ttmFfoPerShare ?? undefined,
    },
  };
}

function assembleUsBdcInputs(raw: RawVehicleData): VehicleSignalBundle {
  const shared = assembleSharedSignals(raw, true);
  const inc = raw.rawIncomeStatements;
  const bal = raw.rawBalanceSheets;

  // Day 13 CAL-2: BDC NII derivation. FMP's standard income-statement
  // schema (probe-confirmed against ARCC 2026-06-23) labels BDC operating
  // income as `operatingIncome` — that's the post-management-fee,
  // post-interest-cost net investment income figure. Fall back to the
  // explicit `netInvestmentIncome` field (FMP exposes it for some BDCs)
  // and then to `revenue - costOfRevenue - operatingExpenses` as a final
  // arithmetic derivation when neither labelled field is present.
  const ttmOperatingIncome = sumFirstN(inc, 4, "operatingIncome");
  const ttmNiiLabelled = sumFirstN(inc, 4, "netInvestmentIncome");
  const ttmRevenueBdc = sumFirstN(inc, 4, "revenue");
  const ttmCostOfRevenue = sumFirstN(inc, 4, "costOfRevenue");
  const ttmOperatingExpenses = sumFirstN(inc, 4, "totalOperatingExpenses");
  const ttmOpExpFallback =
    ttmOperatingExpenses === null
      ? sumFirstN(inc, 4, "operatingExpenses")
      : ttmOperatingExpenses;
  const wgtAvgShs = firstNumber(inc, ["weightedAverageShsOut"]);
  const ttmInterestIncomeRaw = sumFirstN(inc, 4, "totalInterestIncome");
  const ttmNii =
    ttmOperatingIncome !== null
      ? ttmOperatingIncome
      : ttmNiiLabelled !== null
        ? ttmNiiLabelled
        : ttmRevenueBdc !== null && ttmCostOfRevenue !== null && ttmOpExpFallback !== null
          ? ttmRevenueBdc - ttmCostOfRevenue - ttmOpExpFallback
          : ttmInterestIncomeRaw !== null && ttmOpExpFallback !== null
            ? ttmInterestIncomeRaw - ttmOpExpFallback
            : null;
  const ttmNiiPerShare =
    ttmNii !== null && wgtAvgShs !== null && wgtAvgShs > 0 ? ttmNii / wgtAvgShs : null;
  // For R_B1 yield drift we need an "interest income" anchor — use total
  // investment income (revenue) when available, falling back to interest
  // income proper.
  const ttmInterestIncomeFallback =
    ttmRevenueBdc !== null
      ? ttmRevenueBdc
      : sumFirstN(inc, 4, "totalInterestIncome") ?? sumFirstN(inc, 4, "interestIncome");
  const regDps = ttmRegularDps(raw.dividends, raw.asOf);
  const totalDebt = firstNumber(bal, ["totalDebt"]);
  const totalEquity = firstNumber(bal, ["totalEquity"]);
  const navHistory = raw.fundamentals
    .filter((f) => typeof f.nav_per_share === "number" && f.nav_per_share! > 0)
    .map((f) => ({ period_end: f.period_end, nav_per_share: f.nav_per_share! }));
  const regularCut = hasDividendCutInLast5Years(raw.dividends, raw.asOf, true);
  const dividendCut = hasDividendCutInLast5Years(raw.dividends, raw.asOf, false);

  // R_B1: need current + 3y-ago interest income & debt investments. With only
  // 2y of stored quarters (Sprint 1 limit=8), pick the oldest available as
  // "prior" — calibration item if too noisy.
  const debtInvestmentsRecent = firstNumber(bal, ["totalDebt"]); // proxy
  const incOldest = inc[inc.length - 1];
  const balOldest = bal[bal.length - 1];
  const priorInterestIncome =
    typeof incOldest?.totalInterestIncome === "number"
      ? incOldest.totalInterestIncome
      : typeof incOldest?.interestIncome === "number"
        ? incOldest.interestIncome
        : null;
  const priorDebtInvestments =
    typeof balOldest?.totalDebt === "number" ? balOldest.totalDebt : null;

  const cascaded: string[] = [];
  if (ttmNiiPerShare === null) cascaded.push("Q_B1");
  if (navHistory.length < 8) cascaded.push("Q_B2");
  if (totalDebt === null || totalEquity === null) cascaded.push("C_B1");
  if (
    ttmInterestIncomeFallback === null ||
    debtInvestmentsRecent === null ||
    priorInterestIncome === null ||
    priorDebtInvestments === null
  )
    cascaded.push("R_B1");

  return {
    vehicleType: "us_bdc",
    ticker: raw.ticker,
    dataQuality:
      cascaded.length === 0 ? "full" : cascaded.length <= 2 ? "partial" : "sparse",
    qS1: shared.qS1,
    dS1: shared.dS1,
    rS1: shared.rS1,
    qB1:
      ttmNiiPerShare !== null && regDps > 0
        ? { ttmNiiPerShare, ttmRegularDps: regDps }
        : undefined,
    qB2: { navPerShareHistory: navHistory },
    cB1:
      totalDebt !== null && totalEquity !== null
        ? { totalDebt, totalEquity }
        : undefined,
    rB1:
      ttmInterestIncomeFallback !== null &&
      debtInvestmentsRecent !== null &&
      priorInterestIncome !== null &&
      priorDebtInvestments !== null
        ? {
            currentInterestIncome: ttmInterestIncomeFallback,
            currentDebtInvestments: debtInvestmentsRecent,
            priorInterestIncome,
            priorDebtInvestments,
          }
        : undefined,
    rB2: { dividends: raw.dividends, asOf: raw.asOf },
    gateInputs: {
      vehicleType: "us_bdc",
      subSector: raw.subSector,
      dividendCutInLast5Years: dividendCut,
      regularDividendCutInLast5Years: regularCut,
      ttmNiiPerShare: ttmNiiPerShare ?? undefined,
      ttmRegularDps: regDps > 0 ? regDps : undefined,
    },
  };
}

function assembleUkReitInputs(raw: RawVehicleData): VehicleSignalBundle {
  const shared = assembleSharedSignals(raw, false);
  const inc = raw.rawIncomeStatements;
  const bal = raw.rawBalanceSheets;

  // UK reports semi-annually; sum the latest pair (H1 + FY) for TTM.
  const ttmRevenue = sumFirstN(inc, 2, "revenue");
  const ttmOperatingExpenses = sumFirstN(inc, 2, "operatingExpenses");
  const ttmCostOfRevenue = sumFirstN(inc, 2, "costOfRevenue");
  // Net rental income proxy: revenue − operatingExpenses; fall back to revenue
  // − costOfRevenue when operatingExpenses is missing (FMP inconsistency).
  const ttmNetRentalIncome =
    ttmRevenue !== null && ttmOperatingExpenses !== null
      ? ttmRevenue - ttmOperatingExpenses
      : ttmRevenue !== null && ttmCostOfRevenue !== null
        ? ttmRevenue - ttmCostOfRevenue
        : null;
  const ttmDividendsPaid = (() => {
    const v = sumFirstN(inc, 2, "dividendsPaid");
    if (v !== null) return Math.abs(v);
    const wgtAvgShs = firstNumber(inc, ["weightedAverageShsOut"]);
    const dps = trailingDividendTotal(raw.dividends, raw.asOf, 12);
    if (wgtAvgShs !== null && dps > 0) return dps * wgtAvgShs;
    return null;
  })();

  const totalDebt = firstNumber(bal, ["totalDebt"]);
  const totalAssets = firstNumber(bal, ["totalAssets"]);
  const ttmEbitda = sumFirstN(inc, 2, "ebitda");
  const ttmInterestExpense = sumFirstN(inc, 2, "interestExpense");
  // Day 13 CAL-1: gate-input cut detection excludes specials so prior-year
  // supplementals don't inflate the baseline and create false cuts.
  const cuts = hasDividendCutInLast5Years(raw.dividends, raw.asOf, true);

  const propertyType = propertyTypeFor(raw.ticker);
  const geoScope = geographicScopeFor(raw.ticker);

  const cascaded: string[] = [];
  if (ttmNetRentalIncome === null || ttmDividendsPaid === null) cascaded.push("Q_U1");
  if (totalDebt === null || totalAssets === null) cascaded.push("Q_U2");
  if (!propertyType) cascaded.push("C_U1");
  if (!geoScope) cascaded.push("C_U2");
  if (ttmEbitda === null || ttmInterestExpense === null) cascaded.push("R_U1");

  return {
    vehicleType: "uk_reit",
    ticker: raw.ticker,
    dataQuality:
      cascaded.length === 0 ? "full" : cascaded.length <= 2 ? "partial" : "sparse",
    qS1: shared.qS1,
    dS1: shared.dS1,
    rS1: shared.rS1,
    qU1:
      ttmNetRentalIncome !== null && ttmDividendsPaid !== null && ttmDividendsPaid > 0
        ? { ttmNetRentalIncome, ttmTotalDividendsPaid: ttmDividendsPaid }
        : undefined,
    qU2:
      totalDebt !== null && totalAssets !== null
        ? { totalDebt, totalAssets }
        : undefined,
    cU1: propertyType ? { propertyType } : undefined,
    cU2: geoScope ? { geographicScope: geoScope } : undefined,
    rU1:
      ttmEbitda !== null && ttmInterestExpense !== null
        ? { ttmEbitda, ttmInterestExpense }
        : undefined,
    gateInputs: {
      vehicleType: "uk_reit",
      subSector: raw.subSector,
      dividendCutInLast5Years: cuts,
      totalDebt: totalDebt ?? undefined,
      totalAssets: totalAssets ?? undefined,
    },
  };
}

export function assembleVehicleInputs(raw: RawVehicleData): VehicleSignalBundle {
  switch (raw.vehicleType) {
    case "us_reit":
      return assembleUsReitInputs(raw);
    case "us_bdc":
      return assembleUsBdcInputs(raw);
    case "uk_reit":
      return assembleUkReitInputs(raw);
  }
}

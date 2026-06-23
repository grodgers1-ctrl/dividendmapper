// Phase 4 Sprint 2 Day 10 — Vehicle score orchestrator.
// Single entrypoint per vehicle: pulls inputs from Supabase + FMP, runs
// quality gates, dispatches the 8 family-specific signals, aggregates Q/D/C/R
// categories via the existing redistribute-weights, and returns a
// VehicleScoreResult ready for vehicle_scores / vehicle_score_signals
// persistence.
//
// Tests target computeVehicleScoreFromRaw — a pure function on RawVehicleData
// that doesn't touch the network or database. The thin computeVehicleScore
// wrapper does the I/O and is exercised at integration time (Day 11).

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEndpoint } from "./fmp-client";
import {
  fetchVehicleDividendHistory,
  type VehicleType,
} from "./vehicle-fmp";
import {
  assembleVehicleInputs,
  type RawVehicleData,
  type FundamentalsSnapshot,
  type PriceSnapshot,
  type FinancialRow,
  type SegmentationEntry,
  type VehicleSignalBundle,
} from "./vehicle-assemble-inputs";
import { runVehicleQualityGates, type VehicleGateCode } from "./vehicle-quality-gates";
import { computeCategoryAggregate, type SignalWeight } from "./redistribute-weights";
import { computeQS1Streak } from "./signals/q_s1-streak";
import { computeDS1PriceNav } from "./signals/d_s1-price-nav";
import { computeRS1Cut } from "./signals/r_s1-cut";
import { computeQR1FfoPayout } from "./signals/q_r1-ffo-payout";
import { computeQR2DebtEbitda } from "./signals/q_r2-debt-ebitda";
import { computeCR1PropertyHhi } from "./signals/c_r1-property-hhi";
import { computeCR2GeoHhi } from "./signals/c_r2-geo-hhi";
import { computeRR1IntCoverage } from "./signals/r_r1-int-coverage";
import { computeQB1NiiCoverage } from "./signals/q_b1-nii-coverage";
import { computeQB2NavTrend } from "./signals/q_b2-nav-trend";
import { computeCB1StatutoryLeverage } from "./signals/c_b1-statutory-leverage";
import { computeRB1YieldDrift } from "./signals/r_b1-yield-drift";
import { computeRB2SpecialMix } from "./signals/r_b2-special-mix";
import { computeQU1EpraCover } from "./signals/q_u1-epra-cover";
import { computeQU2Ltv } from "./signals/q_u2-ltv";
import { computeCU1PropertyFocus } from "./signals/c_u1-property-focus";
import { computeCU2GeoScope } from "./signals/c_u2-geo-scope";
import { computeRU1IntCoverage } from "./signals/r_u1-int-coverage";

export interface SignalContribution {
  code: string;
  rawScore: number | null;
  weight: number;
  contribution: number;
  humanLabel: string;
}

export interface VehicleScoreResult {
  ticker: string;
  vehicleType: VehicleType;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  failedGates: VehicleGateCode[];
  signals: SignalContribution[];
  dataQuality: "full" | "partial" | "sparse";
  priceNavRatio: number | null;
}

// Category weights — equal-ish, with Q and R weighted slightly heavier to
// reflect the vehicle resilience emphasis (income durability + risk).
const CATEGORY_WEIGHTS = { Q: 0.30, D: 0.20, C: 0.20, R: 0.30 };

interface RunSignal {
  code: string;
  category: "Q" | "D" | "C" | "R";
  baseWeight: number;
  result: { score: number | null; humanLabel: string };
}

function runUsReitSignals(bundle: VehicleSignalBundle): RunSignal[] {
  return [
    { code: "Q_S1", category: "Q", baseWeight: 1 / 3, result: computeQS1Streak(bundle.qS1) },
    {
      code: "Q_R1",
      category: "Q",
      baseWeight: 1 / 3,
      result: bundle.qR1 ? computeQR1FfoPayout(bundle.qR1) : { score: null, humanLabel: "FFO data unavailable" },
    },
    {
      code: "Q_R2",
      category: "Q",
      baseWeight: 1 / 3,
      result: bundle.qR2 ? computeQR2DebtEbitda(bundle.qR2) : { score: null, humanLabel: "leverage data unavailable" },
    },
    { code: "D_S1", category: "D", baseWeight: 1, result: computeDS1PriceNav(bundle.dS1) },
    { code: "C_R1", category: "C", baseWeight: 0.5, result: computeCR1PropertyHhi(bundle.cR1 ?? { segmentShares: [] }) },
    { code: "C_R2", category: "C", baseWeight: 0.5, result: computeCR2GeoHhi(bundle.cR2 ?? { segmentShares: [] }) },
    { code: "R_S1", category: "R", baseWeight: 0.5, result: computeRS1Cut(bundle.rS1) },
    {
      code: "R_R1",
      category: "R",
      baseWeight: 0.5,
      result: bundle.rR1
        ? computeRR1IntCoverage(bundle.rR1)
        : { score: null, humanLabel: "interest coverage data unavailable" },
    },
  ];
}

function runUsBdcSignals(bundle: VehicleSignalBundle): RunSignal[] {
  return [
    { code: "Q_S1", category: "Q", baseWeight: 1 / 3, result: computeQS1Streak(bundle.qS1) },
    {
      code: "Q_B1",
      category: "Q",
      baseWeight: 1 / 3,
      result: bundle.qB1
        ? computeQB1NiiCoverage(bundle.qB1)
        : { score: null, humanLabel: "NII data unavailable" },
    },
    {
      code: "Q_B2",
      category: "Q",
      baseWeight: 1 / 3,
      result: bundle.qB2 && bundle.qB2.navPerShareHistory.length >= 8
        ? computeQB2NavTrend(bundle.qB2)
        : { score: null, humanLabel: "insufficient NAV history" },
    },
    { code: "D_S1", category: "D", baseWeight: 1, result: computeDS1PriceNav(bundle.dS1) },
    {
      code: "C_B1",
      category: "C",
      baseWeight: 1,
      result: bundle.cB1
        ? computeCB1StatutoryLeverage(bundle.cB1)
        : { score: null, humanLabel: "leverage data unavailable" },
    },
    { code: "R_S1", category: "R", baseWeight: 1 / 3, result: computeRS1Cut(bundle.rS1) },
    {
      code: "R_B1",
      category: "R",
      baseWeight: 1 / 3,
      result: bundle.rB1
        ? computeRB1YieldDrift(bundle.rB1)
        : { score: null, humanLabel: "yield drift data unavailable" },
    },
    {
      code: "R_B2",
      category: "R",
      baseWeight: 1 / 3,
      result: bundle.rB2 ? computeRB2SpecialMix(bundle.rB2) : { score: null, humanLabel: "special-mix data unavailable" },
    },
  ];
}

function runUkReitSignals(bundle: VehicleSignalBundle): RunSignal[] {
  return [
    { code: "Q_S1", category: "Q", baseWeight: 1 / 3, result: computeQS1Streak(bundle.qS1) },
    {
      code: "Q_U1",
      category: "Q",
      baseWeight: 1 / 3,
      result: bundle.qU1 ? computeQU1EpraCover(bundle.qU1) : { score: null, humanLabel: "EPRA cover data unavailable" },
    },
    {
      code: "Q_U2",
      category: "Q",
      baseWeight: 1 / 3,
      result: bundle.qU2 ? computeQU2Ltv(bundle.qU2) : { score: null, humanLabel: "LTV data unavailable" },
    },
    { code: "D_S1", category: "D", baseWeight: 1, result: computeDS1PriceNav(bundle.dS1) },
    {
      code: "C_U1",
      category: "C",
      baseWeight: 0.5,
      result: bundle.cU1
        ? computeCU1PropertyFocus(bundle.cU1)
        : { score: null, humanLabel: "ticker not in UK REIT classification" },
    },
    {
      code: "C_U2",
      category: "C",
      baseWeight: 0.5,
      result: bundle.cU2
        ? computeCU2GeoScope(bundle.cU2)
        : { score: null, humanLabel: "ticker not in UK REIT classification" },
    },
    { code: "R_S1", category: "R", baseWeight: 0.5, result: computeRS1Cut(bundle.rS1) },
    {
      code: "R_U1",
      category: "R",
      baseWeight: 0.5,
      result: bundle.rU1
        ? computeRU1IntCoverage(bundle.rU1)
        : { score: null, humanLabel: "interest coverage data unavailable" },
    },
  ];
}

function runSignalsForFamily(bundle: VehicleSignalBundle): RunSignal[] {
  switch (bundle.vehicleType) {
    case "us_reit":
      return runUsReitSignals(bundle);
    case "us_bdc":
      return runUsBdcSignals(bundle);
    case "uk_reit":
      return runUkReitSignals(bundle);
  }
}

function aggregateCategories(signals: RunSignal[]): {
  category: "Q" | "D" | "C" | "R";
  value: number | null;
  contributingCount: number;
}[] {
  const categories: ("Q" | "D" | "C" | "R")[] = ["Q", "D", "C", "R"];
  return categories.map((cat) => {
    const inCat = signals.filter((s) => s.category === cat);
    const sigWeights: SignalWeight[] = inCat.map((s) => ({
      code: s.code,
      score: s.result.score,
      weight: s.baseWeight,
    }));
    const agg = computeCategoryAggregate(sigWeights);
    return {
      category: cat,
      value: agg?.value ?? null,
      contributingCount: agg?.contributingCount ?? 0,
    };
  });
}

function buildSignalContributions(signals: RunSignal[]): SignalContribution[] {
  const byCat = new Map<string, RunSignal[]>();
  for (const s of signals) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }
  const out: SignalContribution[] = [];
  for (const s of signals) {
    const cat = byCat.get(s.category)!;
    const available = cat.filter((c) => c.result.score !== null);
    const availableSum = available.reduce((a, c) => a + c.baseWeight, 0);
    const effective =
      s.result.score === null || availableSum === 0
        ? 0
        : s.baseWeight / availableSum;
    const catWeight = CATEGORY_WEIGHTS[s.category];
    const overallWeight = effective * catWeight;
    const contribution =
      s.result.score === null ? 0 : Math.round(s.result.score * overallWeight * 100) / 100;
    out.push({
      code: s.code,
      rawScore: s.result.score,
      weight: Math.round(overallWeight * 1000) / 1000,
      contribution,
      humanLabel: s.result.humanLabel,
    });
  }
  return out;
}

export function computeVehicleScoreFromRaw(raw: RawVehicleData): VehicleScoreResult {
  const bundle = assembleVehicleInputs(raw);
  const gateResult = runVehicleQualityGates(bundle.gateInputs);
  const signals = runSignalsForFamily(bundle);
  const contributions = buildSignalContributions(signals);
  const priceNavRatio =
    bundle.dS1.navPerShare > 0
      ? Math.round((bundle.dS1.currentPrice / bundle.dS1.navPerShare) * 10000) / 10000
      : null;

  if (!gateResult.passed) {
    return {
      ticker: raw.ticker,
      vehicleType: raw.vehicleType,
      resilienceScore: null,
      qualityGatePassed: false,
      failedGates: gateResult.failedGates,
      signals: contributions,
      dataQuality: bundle.dataQuality,
      priceNavRatio,
    };
  }

  const aggs = aggregateCategories(signals);
  const availableCats = aggs.filter((a) => a.value !== null);
  if (availableCats.length === 0) {
    return {
      ticker: raw.ticker,
      vehicleType: raw.vehicleType,
      resilienceScore: null,
      qualityGatePassed: true,
      failedGates: [],
      signals: contributions,
      dataQuality: "sparse",
      priceNavRatio,
    };
  }
  const availableWeightSum = availableCats.reduce(
    (s, a) => s + CATEGORY_WEIGHTS[a.category],
    0,
  );
  const composite = availableCats.reduce(
    (s, a) =>
      s + (a.value as number) * (CATEGORY_WEIGHTS[a.category] / availableWeightSum),
    0,
  );
  const score = Math.max(0, Math.min(100, Math.round(composite)));

  return {
    ticker: raw.ticker,
    vehicleType: raw.vehicleType,
    resilienceScore: score,
    qualityGatePassed: true,
    failedGates: [],
    signals: contributions,
    dataQuality: bundle.dataQuality,
    priceNavRatio,
  };
}

// -------- I/O wrapper --------

interface UniverseRow {
  ticker: string;
  vehicle_type: VehicleType;
  currency: string;
  sub_sector: string | null;
}

async function fetchRawVehicleData(
  supabase: SupabaseClient,
  ticker: string,
  vehicleType: VehicleType,
): Promise<RawVehicleData> {
  const asOf = new Date();

  // Universe row → currency + sub_sector
  const { data: universe, error: uErr } = await supabase
    .from("vehicle_universe")
    .select("ticker, vehicle_type, currency, sub_sector")
    .eq("ticker", ticker)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!universe) throw new Error(`vehicle_universe missing row for ${ticker}`);
  const u = universe as UniverseRow;
  const currency = (u.currency ?? "USD") as "USD" | "GBP" | "GBX";

  // Fundamentals — latest 12 periods, date-asc for the assembler.
  const { data: fundamentals } = await supabase
    .from("vehicle_fundamentals")
    .select("period_end, period_type, nav_per_share, debt_total, equity_total, ebitda, interest_expense")
    .eq("ticker", ticker)
    .order("period_end", { ascending: false })
    .limit(12);
  const fundAsc: FundamentalsSnapshot[] = (fundamentals ?? [])
    .slice()
    .reverse() as FundamentalsSnapshot[];

  // Prices — last 5y, date-asc.
  const fiveYearsAgo = new Date(asOf.getTime() - 5 * 365 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: prices } = await supabase
    .from("vehicle_prices")
    .select("observed_at, close_price")
    .eq("ticker", ticker)
    .gte("observed_at", fiveYearsAgo)
    .order("observed_at", { ascending: true });
  const priceList: PriceSnapshot[] = (prices ?? []) as PriceSnapshot[];

  // Dividends — 10y back via FMP (cached at the fmp-client TTL layer).
  const dividends = await fetchVehicleDividendHistory(ticker, 10, currency);

  // Raw FMP income/balance — limit 4 quarters (US) or 4 semi-annual (UK, gives
  // 2y of TTM coverage with H1+FY pairs).
  const fmpPeriod: "quarter" | "annual" = vehicleType === "uk_reit" ? "annual" : "quarter";
  const fmpLimit = 8;
  const [income, balance] = await Promise.all([
    fetchEndpoint("income-statement", {
      symbol: ticker,
      period: fmpPeriod,
      limit: String(fmpLimit),
    }) as Promise<FinancialRow[]>,
    fetchEndpoint("balance-sheet-statement", {
      symbol: ticker,
      period: fmpPeriod,
      limit: String(fmpLimit),
    }) as Promise<FinancialRow[]>,
  ]);

  // Segmentation — only meaningful for US REITs; UK REITs use the JSON helper.
  let productSegmentation: SegmentationEntry[] = [];
  let geoSegmentation: SegmentationEntry[] = [];
  if (vehicleType === "us_reit") {
    try {
      productSegmentation = (await fetchEndpoint("revenue-product-segmentation", {
        symbol: ticker,
        period: "annual",
      })) as SegmentationEntry[];
    } catch {
      productSegmentation = [];
    }
    try {
      geoSegmentation = (await fetchEndpoint("revenue-geographic-segmentation", {
        symbol: ticker,
        period: "annual",
      })) as SegmentationEntry[];
    } catch {
      geoSegmentation = [];
    }
  }

  return {
    ticker,
    vehicleType,
    subSector: u.sub_sector,
    currency,
    fundamentals: fundAsc,
    prices: priceList,
    dividends,
    productSegmentation,
    geoSegmentation,
    rawIncomeStatements: income ?? [],
    rawBalanceSheets: balance ?? [],
    asOf,
  };
}

export async function computeVehicleScore(
  supabase: SupabaseClient,
  ticker: string,
  vehicleType: VehicleType,
): Promise<VehicleScoreResult> {
  const raw = await fetchRawVehicleData(supabase, ticker, vehicleType);
  return computeVehicleScoreFromRaw(raw);
}

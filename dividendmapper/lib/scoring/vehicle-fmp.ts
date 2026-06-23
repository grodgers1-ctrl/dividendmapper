// Phase 4 Sprint 1 Day 2 — Income Vehicle FMP ingestion.
//
// Thin orchestration over fmp-client.ts (Day 5 fetchEndpoint() + typed
// wrappers) that returns rows pre-shaped for the vehicle_* tables. Three
// vehicle families share the price + dividend fetchers; fundamentals dispatch
// per vehicleType because the required FMP endpoints diverge.
//
// Currency handling: LSE tickers are reported by FMP in GBp (pence). Price
// and dividend amounts are normalised to GBP at ingestion so the persisted
// data is unit-consistent across all three families. Pass `currency`
// explicitly (sourced from vehicle_universe.currency) to control this.

import { fetchEndpoint, getDividends, getHistoricalEod } from "./fmp-client";

export type VehicleType = "us_reit" | "us_bdc" | "uk_reit";
export type Currency = "USD" | "GBP" | "GBX";

export interface VehiclePriceRow {
  ticker: string;
  observed_at: string;
  close_price: number;
}

function isoDateOffset(daysBack: number): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function normaliseToGbp(value: number, currency: Currency): number {
  return currency === "GBX" ? round4(value / 100) : value;
}

export async function fetchVehiclePrices(
  ticker: string,
  daysBack: number,
  currency: Currency,
): Promise<VehiclePriceRow[]> {
  const { from, to } = isoDateOffset(daysBack);
  const bars = await getHistoricalEod(ticker, from, to);
  return bars.map((bar) => ({
    ticker,
    observed_at: bar.date,
    close_price: normaliseToGbp(bar.close, currency),
  }));
}

export interface VehicleFundamentalsRow {
  ticker: string;
  period_end: string;
  period_type: "quarterly" | "semi_annual" | "annual";
  ffo_per_share: number | null;
  affo_per_share: number | null;
  nii_per_share: number | null;
  nav_per_share: number | null;
  debt_total: number | null;
  equity_total: number | null;
  ebitda: number | null;
  interest_expense: number | null;
  ltv_pct: number | null;
}

interface FmpFinancialRow {
  date: string;
  [k: string]: unknown;
}

function num(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fetchFinancialPeriod(
  endpoint: string,
  ticker: string,
  period: "quarter" | "annual",
  limit: number,
): Promise<FmpFinancialRow[]> {
  return (await fetchEndpoint(endpoint, {
    symbol: ticker,
    period,
    limit: String(limit),
  })) as FmpFinancialRow[];
}

function alignByDate<T extends FmpFinancialRow>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) m.set(r.date, r);
  return m;
}

export async function fetchVehicleFundamentals(
  ticker: string,
  vehicleType: VehicleType,
  currency: Currency,
): Promise<VehicleFundamentalsRow[]> {
  // US REIT + US BDC report quarterly; UK REIT reports H1 + FY (FMP exposes
  // both as period=annual). Derived metrics (FFO/NII/LTV) computed at signal
  // time in Sprint 2 — Day 2 ingestion stores the raw inputs only.
  const fmpPeriod: "quarter" | "annual" = vehicleType === "uk_reit" ? "annual" : "quarter";
  const periodType: VehicleFundamentalsRow["period_type"] =
    vehicleType === "uk_reit" ? "semi_annual" : "quarterly";
  const limit = vehicleType === "uk_reit" ? 10 : 8;

  const [income, balance, keyMetrics] = await Promise.all([
    fetchFinancialPeriod("income-statement", ticker, fmpPeriod, limit),
    fetchFinancialPeriod("balance-sheet-statement", ticker, fmpPeriod, limit),
    fetchFinancialPeriod("key-metrics", ticker, fmpPeriod, limit),
  ]);

  const balanceByDate = alignByDate(balance);
  const keyByDate = alignByDate(keyMetrics);

  const rows: VehicleFundamentalsRow[] = [];
  for (const inc of income) {
    const bal = balanceByDate.get(inc.date);
    const km = keyByDate.get(inc.date);
    const navRaw = km ? num(km, "bookValuePerShare") : null;
    rows.push({
      ticker,
      period_end: inc.date,
      period_type: periodType,
      ffo_per_share: null,     // signal-time derivation (Sprint 2)
      affo_per_share: null,    // V1.1
      nii_per_share: null,     // signal-time derivation (Sprint 2)
      nav_per_share: navRaw === null ? null : normaliseToGbp(navRaw, currency),
      debt_total: bal ? num(bal, "totalDebt") : null,
      equity_total: bal ? num(bal, "totalEquity") : null,
      ebitda: num(inc, "ebitda"),
      interest_expense: num(inc, "interestExpense"),
      ltv_pct: null,           // signal-time derivation (Sprint 2)
    });
  }
  return rows;
}

export interface VehicleDividendRow {
  ticker: string;
  ex_date: string;
  payment_date: string | null;
  dividend: number;
}

export async function fetchVehicleDividendHistory(
  ticker: string,
  yearsBack: number,
  currency: Currency,
): Promise<VehicleDividendRow[]> {
  // Monthly payers (Realty Income etc.) need yearsBack × 12 records to cover
  // the full window. Quarterly + semi-annual payers benefit from the same
  // depth — FMP caps at limit anyway, so over-asking is cheap.
  const limit = yearsBack * 12;
  const rows = await getDividends(ticker, limit);
  return rows.map((row) => ({
    ticker,
    ex_date: row.date,
    payment_date: (row.paymentDate as string | undefined) || null,
    dividend: normaliseToGbp(row.dividend, currency),
  }));
}

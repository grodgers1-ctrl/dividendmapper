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

import { getDividends, getHistoricalEod } from "./fmp-client";

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

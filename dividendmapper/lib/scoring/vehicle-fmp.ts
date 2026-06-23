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

import { getHistoricalEod } from "./fmp-client";

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

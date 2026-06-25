import type { VehicleType } from "./load-vehicle-score";
import type { VehicleScoreResult } from "./compute-vehicle-score";

// Per-family code for the headline leverage signal. The signal's humanLabel
// is surfaced on the /income-vehicles hub results table as a one-line
// resilience summary. Must match the codes wired in compute-vehicle-score.ts.
const HEADLINE_SIGNAL: Record<VehicleType, string> = {
  us_reit: "Q_R1", // FFO payout
  us_bdc: "Q_B1", // NII coverage
  uk_reit: "Q_U2", // LTV
};

export function pickLeverageHeadline(result: VehicleScoreResult): string | null {
  const code = HEADLINE_SIGNAL[result.vehicleType];
  const hit = result.signals.find((s) => s.code === code);
  return hit?.humanLabel ?? null;
}

export interface VehicleUniverseDisplayRow {
  ticker: string;
  dividend_yield: number | null;
  leverage_headline: string | null;
}

// Fire-and-forget yield fetch. The cron should never crash because FMP
// returned a 5xx for one ticker's yield — degrade gracefully to null.
export type FetchYield = (ticker: string) => Promise<number | null>;

export async function buildVehicleUniverseDisplayRow(
  result: VehicleScoreResult,
  fetchYield: FetchYield,
): Promise<VehicleUniverseDisplayRow> {
  const leverage_headline = pickLeverageHeadline(result);
  let dividend_yield: number | null = null;
  try {
    dividend_yield = await fetchYield(result.ticker);
  } catch {
    dividend_yield = null;
  }
  return {
    ticker: result.ticker,
    dividend_yield,
    leverage_headline,
  };
}

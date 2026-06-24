import type { VehicleType } from "./load-vehicle-score";

// Maps a holding to one of four income-resilience bands. Drives the Anchors
// vs Exposures dashboard card and is the hook for V1.1 "rebalance toward
// anchors" suggestions. Pure function — no I/O — so the dashboard server
// component can call it inline.
//
// Bands (vehicles, by Resilience):
//   resilienceScore >= 75               → "anchor"
//   50 <= resilienceScore < 75          → "exposure"
//   resilienceScore < 50 OR gate-failed → "risk"
// Bands (equities, by Quality / buyScore):
//   buyScore >= 75                      → "anchor"
//   50 <= buyScore < 75                 → "exposure"
//   buyScore < 50 OR gate-failed        → "risk"
// Anything else (missing score, missing data)  → "unscored"

export type IncomeBand = "anchor" | "exposure" | "risk" | "unscored";

export interface ClassifyInput {
  vehicleType: VehicleType | "equity";
  resilienceScore: number | null;
  buyScore: number | null;
  qualityGatePassed: boolean;
}

export function classifyHolding(input: ClassifyInput): IncomeBand {
  const { vehicleType, resilienceScore, buyScore, qualityGatePassed } = input;
  if (vehicleType === "equity") {
    if (buyScore === null) return "unscored";
    if (!qualityGatePassed) return "risk";
    if (buyScore >= 75) return "anchor";
    if (buyScore >= 50) return "exposure";
    return "risk";
  }
  // Vehicle path: REIT / BDC / UK REIT.
  if (resilienceScore === null) return "unscored";
  if (!qualityGatePassed) return "risk";
  if (resilienceScore >= 75) return "anchor";
  if (resilienceScore >= 50) return "exposure";
  return "risk";
}

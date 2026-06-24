// One-sentence headline + chip colour for the public vehicle pages. Pure (no
// I/O) so it unit-tests cleanly. Mirrors public-summary.ts for the equity
// engine but operates on the Resilience composite (single number) rather than
// the Quality/Risk/Trim triple.
//
// COMPLIANCE: every string here ships on a public, indexable surface. Never
// "buy/sell/recommend"; the framing is informational resilience, not advice.

import type { VehicleScoreLoadResult } from "./load-vehicle-score";

export type ChipColor = "green" | "amber" | "red" | "grey";

export interface VehiclePublicSummary {
  headline: string;
  chipColor: ChipColor;
}

export function vehiclePublicSummary(score: VehicleScoreLoadResult): VehiclePublicSummary {
  if (!score.qualityGatePassed || score.resilienceScore === null) {
    return {
      headline: `${score.displayName} has not cleared the dividend-quality gate; its resilience score is not available.`,
      chipColor: "grey",
    };
  }

  const r = score.resilienceScore;
  if (r >= 70) {
    return {
      headline: `${score.displayName} screens as a resilient income vehicle on the V1 framework.`,
      chipColor: "green",
    };
  }
  if (r >= 50) {
    return {
      headline: `${score.displayName} screens as moderately resilient on the V1 framework.`,
      chipColor: "amber",
    };
  }
  return {
    headline: `${score.displayName} screens weakly for dividend resilience on the V1 framework.`,
    chipColor: "red",
  };
}

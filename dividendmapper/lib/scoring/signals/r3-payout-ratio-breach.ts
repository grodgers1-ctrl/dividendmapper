// R3 — payout ratio vs a sector-adjusted threshold. REITs and utilities
// structurally run hotter payouts; financials run cooler. Breach → 20pts;
// within 5pts of the threshold → 10pts.

import type { Sector } from "../sector";

export interface R3Inputs {
  payoutRatio: number; // decimal, e.g. 0.85 for 85%
  sector: Sector;
}

export interface R3Result {
  points: number;
  fired: boolean;
  reason: string;
}

function threshold(sector: Sector): number {
  if (sector === "real_estate") return 0.95;
  if (sector === "utility") return 0.9;
  if (sector === "financial") return 0.6;
  return 0.8;
}

export function computeR3PayoutRatioBreach(inputs: R3Inputs): R3Result {
  const t = threshold(inputs.sector);
  if (inputs.payoutRatio >= t) {
    return {
      points: 20,
      fired: true,
      reason: `Payout ${(inputs.payoutRatio * 100).toFixed(0)}% > sector threshold ${(t * 100).toFixed(0)}%`,
    };
  }
  if (inputs.payoutRatio >= t - 0.05) {
    return { points: 10, fired: true, reason: `Payout near sector threshold` };
  }
  return {
    points: 0,
    fired: false,
    reason: `Payout ${(inputs.payoutRatio * 100).toFixed(0)}% within sector norms`,
  };
}

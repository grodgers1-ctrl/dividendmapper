// R_U1 — UK REIT interest coverage (EBITDA TTM / interest expense TTM).
// Same computation as R_R1 but with tighter thresholds reflecting UK REIT
// lower-gearing convention (LTV typically capped at ~35-40% by covenants
// or board policy, so the sector expects 4×+ coverage as "comfortable").
//
// Shares `interestCoverageRatio` with R_R1 so the ratio math has one home;
// banding is intentionally per-family so each family's thresholds stay
// visible at read time.

import { interestCoverageRatio } from "./r_r1-int-coverage";

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface RU1Inputs {
  ttmEbitda: number;
  ttmInterestExpense: number;
}

export function computeRU1IntCoverage(inputs: RU1Inputs): SignalResult {
  const cov = interestCoverageRatio(inputs.ttmEbitda, inputs.ttmInterestExpense);
  if (cov === null) {
    return { score: null, humanLabel: "no interest expense / data error" };
  }
  if (inputs.ttmEbitda <= 0) {
    return { score: 0, humanLabel: "EBITDA non-positive vs. interest expense" };
  }
  let score: number;
  if (cov < 2.0) score = 0;
  else if (cov <= 3.5) score = 50;
  else score = 100;
  return {
    score,
    humanLabel: `Interest coverage ${cov.toFixed(1)}×`,
  };
}

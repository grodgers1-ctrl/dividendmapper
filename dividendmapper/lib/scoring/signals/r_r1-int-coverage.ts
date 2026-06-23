// R_R1 — US REIT interest coverage (EBITDA TTM / interest expense TTM).
// Below 2.5× signals that a single bad year or rate refinance could turn
// operating cash flow negative on a coverage basis.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface RR1Inputs {
  ttmEbitda: number;
  ttmInterestExpense: number;
}

export function computeRR1IntCoverage(inputs: RR1Inputs): SignalResult {
  if (inputs.ttmInterestExpense <= 0) {
    return { score: null, humanLabel: "no interest expense / data error" };
  }
  if (inputs.ttmEbitda <= 0) {
    return { score: 0, humanLabel: "EBITDA non-positive vs. interest expense" };
  }
  const cov = inputs.ttmEbitda / inputs.ttmInterestExpense;
  let score: number;
  if (cov < 2.5) score = 0;
  else if (cov <= 4) score = 50;
  else score = 100;
  return {
    score,
    humanLabel: `Interest coverage ${cov.toFixed(1)}×`,
  };
}

// Shared helper consumed by R_U1 (UK REIT) with a tighter sector-aware
// threshold. Keeping the family-specific scoring split rather than sharing
// the score function so each family's banding stays visible at read time.
export function interestCoverageRatio(ebitda: number, interestExpense: number): number | null {
  if (interestExpense <= 0) return null;
  return ebitda / interestExpense;
}

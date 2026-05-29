// R6 — year-over-year decline in interest coverage (EBIT/interest). Steep drop
// (>=40%) → 15pts; moderate (20-40%) → 10pts; or crossing below 3x (after being
// at/above it) → 10pts. Prior coverage <= 0 is non-comparable → 0.

export interface R6Inputs {
  currentInterestCoverage: number;
  yearAgoInterestCoverage: number;
}

export interface R6Result {
  points: number;
  fired: boolean;
  reason: string;
}

export function computeR6InterestCoverageDecline(inputs: R6Inputs): R6Result {
  if (inputs.yearAgoInterestCoverage <= 0) {
    return { points: 0, fired: false, reason: "Prior interest coverage non-positive" };
  }
  const delta =
    (inputs.currentInterestCoverage - inputs.yearAgoInterestCoverage) / inputs.yearAgoInterestCoverage;
  if (delta <= -0.4) return { points: 15, fired: true, reason: `Interest coverage -${Math.abs(delta * 100).toFixed(0)}% YoY (steep)` };
  if (delta <= -0.2) return { points: 10, fired: true, reason: `Interest coverage -${Math.abs(delta * 100).toFixed(0)}% YoY` };
  if (inputs.yearAgoInterestCoverage >= 3 && inputs.currentInterestCoverage < 3) {
    return { points: 10, fired: true, reason: "Interest coverage crossed below 3x" };
  }
  return { points: 0, fired: false, reason: "Interest coverage stable" };
}

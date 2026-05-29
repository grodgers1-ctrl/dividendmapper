// R5 — year-over-year change in Net Debt/EBITDA. Rapid leveraging up is a
// dividend-risk precursor. +30% YoY → 15pts; +15-30% → 10pts; else 0.
// Prior leverage <= 0 (net cash) is treated as non-comparable → 0.

export interface R5Inputs {
  currentNetDebtToEbitda: number;
  yearAgoNetDebtToEbitda: number;
}

export interface R5Result {
  points: number;
  fired: boolean;
  reason: string;
}

export function computeR5DebtAcceleration(inputs: R5Inputs): R5Result {
  if (inputs.yearAgoNetDebtToEbitda <= 0) {
    return { points: 0, fired: false, reason: "Prior debt/EBITDA non-positive" };
  }
  const delta =
    (inputs.currentNetDebtToEbitda - inputs.yearAgoNetDebtToEbitda) / inputs.yearAgoNetDebtToEbitda;
  if (delta >= 0.3) return { points: 15, fired: true, reason: `Net Debt/EBITDA +${(delta * 100).toFixed(0)}% YoY (steep)` };
  if (delta >= 0.15) return { points: 10, fired: true, reason: `Net Debt/EBITDA +${(delta * 100).toFixed(0)}% YoY` };
  return { points: 0, fired: false, reason: "Leverage stable" };
}

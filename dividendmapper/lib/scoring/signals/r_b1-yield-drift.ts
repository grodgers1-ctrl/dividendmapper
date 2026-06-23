// R_B1 — BDC portfolio yield drift over the last 3 years.
// Compare (current interest income / current debt investments) to the same
// ratio 3 years ago. Sharp moves either way are a red flag: a sharp increase
// often reflects PIK income or non-accrual loans pushed into "interest"; a
// sharp decrease can mean rates have repriced down or quality borrowers
// refinanced away.
//
// Caller pulls the prior ratio from the fundamentals row closest to today−3y.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface RB1Inputs {
  currentInterestIncome: number;
  currentDebtInvestments: number;
  priorInterestIncome: number;
  priorDebtInvestments: number;
}

export function computeRB1YieldDrift(inputs: RB1Inputs): SignalResult {
  if (inputs.currentDebtInvestments <= 0 || inputs.priorDebtInvestments <= 0) {
    return { score: null, humanLabel: "debt investments unavailable" };
  }
  const cur = inputs.currentInterestIncome / inputs.currentDebtInvestments;
  const prev = inputs.priorInterestIncome / inputs.priorDebtInvestments;
  const deltaPp = Math.abs(cur - prev) * 100;
  let score: number;
  if (deltaPp <= 1) score = 100;
  else if (deltaPp <= 2) score = 75;
  else if (deltaPp <= 3) score = 50;
  else if (deltaPp <= 4) score = 25;
  else score = 0;
  const dir = cur >= prev ? "+" : "−";
  return {
    score,
    humanLabel: `Portfolio yield drift ${dir}${deltaPp.toFixed(1)}pp over 3y`,
  };
}

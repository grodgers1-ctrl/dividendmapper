// Q_U2 — UK REIT Loan-to-Value (totalDebt / totalAssets).
// The canonical UK REIT leverage metric — quoted in every annual report. Above
// 50% is the sector-aware G_U1 gate threshold (industrial-only REITs are
// capped tighter at 40%; healthcare and social-housing get 60% headroom).

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QU2Inputs {
  totalDebt: number;
  totalAssets: number;
}

export function computeQU2Ltv(inputs: QU2Inputs): SignalResult {
  if (inputs.totalAssets <= 0) {
    return { score: null, humanLabel: "total assets unavailable" };
  }
  const ltv = inputs.totalDebt / inputs.totalAssets;
  const ltvPct = ltv * 100;
  let score: number;
  if (ltvPct <= 25) score = 100;
  else if (ltvPct <= 35) score = 75;
  else if (ltvPct <= 45) score = 50;
  else if (ltvPct <= 55) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `LTV ${ltvPct.toFixed(1)}%`,
  };
}

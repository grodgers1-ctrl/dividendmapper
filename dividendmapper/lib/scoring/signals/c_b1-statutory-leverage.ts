// C_B1 — BDC debt-to-equity vs the SBCAA-relaxed 2:1 statutory cap.
// Investment Company Act §61 (post-2018 amendment) caps leverage at 2:1 for
// BDCs that adopt the relaxed rule. A 1.5× ratio (75% of cap) is the
// industry "amber" zone — at 1.8×+ a single quarter of credit losses can
// force asset sales to stay under the statutory ceiling.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface CB1Inputs {
  totalDebt: number;
  totalEquity: number;
}

export function computeCB1StatutoryLeverage(inputs: CB1Inputs): SignalResult {
  if (inputs.totalEquity <= 0) {
    return { score: null, humanLabel: "non-positive equity" };
  }
  const ratio = inputs.totalDebt / inputs.totalEquity;
  let score: number;
  if (ratio <= 1.0) score = 100;
  else if (ratio <= 1.3) score = 75;
  else if (ratio <= 1.5) score = 50;
  else if (ratio <= 1.8) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `Debt/equity ${ratio.toFixed(2)}× (statutory cap 2.0×)`,
  };
}

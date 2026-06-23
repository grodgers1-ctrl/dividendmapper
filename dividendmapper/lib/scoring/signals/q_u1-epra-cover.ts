// Q_U1 — UK REIT EPRA dividend cover (V1 proxy).
// True EPRA cover is EPRA EPS / DPS as defined by the European Public Real
// Estate Association — FMP doesn't expose EPRA earnings for UK names yet, so
// V1 uses net rental income TTM ÷ total dividends paid TTM as a proxy.
// Calibration of this proxy against published EPRA figures for ~3 UK names
// is a Day 13 task; V1.1 swaps in the proper EPRA EPS series.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QU1Inputs {
  ttmNetRentalIncome: number;
  ttmTotalDividendsPaid: number;
}

export function computeQU1EpraCover(inputs: QU1Inputs): SignalResult {
  if (inputs.ttmTotalDividendsPaid <= 0) {
    return { score: null, humanLabel: "no dividend payments in window" };
  }
  if (inputs.ttmNetRentalIncome <= 0) {
    return { score: 0, humanLabel: "net rental income non-positive" };
  }
  const cover = inputs.ttmNetRentalIncome / inputs.ttmTotalDividendsPaid;
  let score: number;
  if (cover >= 1.20) score = 100;
  else if (cover >= 1.10) score = 75;
  else if (cover >= 1.00) score = 50;
  else if (cover >= 0.90) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `EPRA cover proxy ${cover.toFixed(2)}× (rental income / DPS)`,
  };
}

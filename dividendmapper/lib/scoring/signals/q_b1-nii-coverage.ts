// Q_B1 — BDC net investment income (NII) coverage of regular DPS (TTM).
// NII per share TTM ÷ regular dividend per share TTM. < 0.95 fails the G_B1
// gate at composite time — the dividend isn't earned and ROC or NAV erosion
// follows.
//
// Source decision (probe-confirmed 2026-06-23): FMP's income statement for
// BDC tickers exposes `netInterestIncome` on some entries, but most use
// `totalInterestIncome` − `totalOperatingExpenses` to derive NII. The
// orchestrator handles that derivation; this signal just consumes the ratio.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QB1Inputs {
  ttmNiiPerShare: number;
  ttmRegularDps: number;
}

export function computeQB1NiiCoverage(inputs: QB1Inputs): SignalResult {
  if (inputs.ttmRegularDps <= 0) {
    return { score: null, humanLabel: "no regular dividend stream" };
  }
  const ratio = inputs.ttmNiiPerShare / inputs.ttmRegularDps;
  let score: number;
  if (ratio < 0.95) score = 0;
  else if (ratio < 1.0) score = 25;
  else if (ratio < 1.05) score = 50;
  else if (ratio < 1.15) score = 75;
  else score = 100;
  return {
    score,
    humanLabel: `NII covers regular dividend ${ratio.toFixed(2)}×`,
  };
}

// Q_R1 — US REIT FFO payout ratio (TTM DPS / TTM FFO per share).
// FFO is the REIT-canonical proxy for distributable cash; payout ratio ≥ 100%
// means the dividend is being funded from non-recurring sources or capital and
// fails the G_R1 quality gate at composite time. Caller (orchestrator) sums
// trailing-four-quarter values from vehicle_fundamentals before calling.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QR1Inputs {
  ttmDps: number;
  ttmFfoPerShare: number;
}

export function computeQR1FfoPayout(inputs: QR1Inputs): SignalResult {
  if (inputs.ttmFfoPerShare <= 0) {
    return { score: null, humanLabel: "FFO per share unavailable" };
  }
  const ratio = inputs.ttmDps / inputs.ttmFfoPerShare;
  const pctLabel = `${Math.round(ratio * 100)}%`;
  let score: number;
  if (ratio <= 0.70) score = 100;
  else if (ratio <= 0.85) score = 75;
  else if (ratio <= 0.95) score = 50;
  else if (ratio <= 1.00) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `FFO payout ${pctLabel}`,
  };
}

// Q_R2 — US REIT net-debt to EBITDA (TTM).
// Net Debt = total debt − cash and short-term investments. Sector convention
// caps healthy gearing around 6× EBITDA; > 10× signals refinancing risk.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QR2Inputs {
  totalDebt: number;
  cash: number;
  ttmEbitda: number;
}

export function computeQR2DebtEbitda(inputs: QR2Inputs): SignalResult {
  if (inputs.ttmEbitda <= 0) {
    return { score: null, humanLabel: "EBITDA non-positive" };
  }
  const netDebt = inputs.totalDebt - inputs.cash;
  if (netDebt <= 0) {
    return { score: 100, humanLabel: "net cash position" };
  }
  const ratio = netDebt / inputs.ttmEbitda;
  let score: number;
  if (ratio <= 4) score = 100;
  else if (ratio <= 6) score = 75;
  else if (ratio <= 8) score = 50;
  else if (ratio <= 10) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `Net debt / EBITDA ${ratio.toFixed(1)}×`,
  };
}

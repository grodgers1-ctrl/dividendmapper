type Current = Record<string, number | null>;
type Percentiles = Record<string, number | null>;

function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return 'n/a';
  return `P${Math.round(v * 100)}`;
}

function describeValue(peP: number | null): string {
  if (peP === null || !Number.isFinite(peP)) return 'has limited valuation history available';
  if (peP >= 0.7) return 'is historically expensive';
  if (peP <= 0.3) return 'is historically cheap';
  return 'is mid-band on valuation';
}

export function synthesiseVerdicts(input: {
  ticker: string;
  current: Current;
  percentiles: Percentiles;
}): { value: string; safety: string; growth: string; profitability: string } {
  const { ticker, percentiles } = input;
  return {
    value: `${ticker} ${describeValue(percentiles.pe)}. P/E at ${pct(percentiles.pe)}; yield at ${pct(percentiles.dividend_yield)}.`,
    safety: `FCF payout sits at ${pct(percentiles.fcf_payout)} of its history. Leverage (Net Debt/EBITDA) at ${pct(percentiles.net_debt_ebitda)}; interest cover at ${pct(percentiles.interest_coverage)}.`,
    growth: `5-year dividend growth at ${pct(percentiles.dgr_5y)} of its 10y range. FCF growth ${pct(percentiles.fcf_growth_yoy)}; ROIC ${pct(percentiles.roic)}.`,
    profitability: `Gross margin at ${pct(percentiles.gross_margin)} of its history. Operating margin ${pct(percentiles.operating_margin)}; net margin ${pct(percentiles.net_margin)}.`,
  };
}

import { formatMetric, METRIC_FORMAT } from "./format-metric";
import type { InspectMetricKey } from "./types";

type Current = Record<string, number | null>;
type Percentiles = Record<string, number | null>;

function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  return `P${Math.round(v * 100)}`;
}

function describeValue(peP: number | null): string {
  if (peP === null || !Number.isFinite(peP)) return "has limited valuation history available";
  if (peP >= 0.7) return "is historically expensive";
  if (peP <= 0.3) return "is historically cheap";
  return "is mid-band on valuation";
}

function call(percentiles: Percentiles, current: Current, key: InspectMetricKey): string {
  const p = pct(percentiles[key] ?? null);
  const raw = current[key] ?? null;
  if (raw === null || !Number.isFinite(raw)) return p;
  return `${p} (${formatMetric(raw, METRIC_FORMAT[key])})`;
}

export function synthesiseVerdicts(input: {
  ticker: string;
  current: Current;
  percentiles: Percentiles;
}): { value: string; safety: string; growth: string; profitability: string } {
  const { ticker, current, percentiles } = input;
  const c = (k: InspectMetricKey) => call(percentiles, current, k);
  return {
    value: `${ticker} ${describeValue(percentiles.pe)}. P/E at ${c("pe")}; yield at ${c("dividend_yield")}.`,
    safety: `FCF payout sits at ${c("fcf_payout")} of its history. Leverage (Net Debt/EBITDA) at ${c("net_debt_ebitda")}; interest cover at ${c("interest_coverage")}.`,
    growth: `5-year dividend growth at ${c("dgr_5y")} of its 10y range. FCF growth ${c("fcf_growth_yoy")}; ROIC ${c("roic")}.`,
    profitability: `Gross margin at ${c("gross_margin")} of its history. Operating margin ${c("operating_margin")}; net margin ${c("net_margin")}.`,
  };
}

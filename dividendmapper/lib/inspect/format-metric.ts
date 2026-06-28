import type { InspectMetricFormat, InspectMetricKey } from "./types";

export function formatMetric(v: number | null, format: InspectMetricFormat): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  switch (format) {
    case "pct":
      return `${(v * 100).toFixed(0)}%`;
    case "pct1":
      return `${(v * 100).toFixed(1)}%`;
    case "multiple":
      return `${v.toFixed(1)}x`;
    case "ratio":
      return v.toFixed(2);
  }
}

export const METRIC_FORMAT: Record<InspectMetricKey, InspectMetricFormat> = {
  pe: "multiple",
  p_fcf: "multiple",
  dividend_yield: "pct1",
  fcf_payout: "pct",
  net_debt_ebitda: "ratio",
  interest_coverage: "ratio",
  dgr_5y: "pct",
  fcf_growth_yoy: "pct",
  roic: "pct",
  gross_margin: "pct",
  operating_margin: "pct",
  net_margin: "pct",
};

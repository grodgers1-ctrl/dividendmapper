// Buy D1 — Stock yield relative to its sector median. A yield well above the
// sector norm flags an income premium (or, paired with the quality gates, a
// genuine value opportunity). Map: 1.5x sector median → 100; parity → 50;
// 0.5x → 0. N/A when the sector median is unavailable.

import type { SignalResult } from "./a1-yield-percentile";

export interface D1Inputs {
  stockYield: number;
  sectorMedianYield: number | null;
}

export function computeD1YieldVsSector(inputs: D1Inputs): SignalResult {
  if (inputs.sectorMedianYield == null || inputs.sectorMedianYield <= 0 || inputs.stockYield <= 0) {
    return { score: null, humanLabel: "Sector median yield unavailable" };
  }
  const ratio = inputs.stockYield / inputs.sectorMedianYield;
  // 0.5x → 0, 1x → 50, 1.5x → 100
  const raw = 50 + (ratio - 1) * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const stockPct = (inputs.stockYield * 100).toFixed(2);
  const sectorPct = (inputs.sectorMedianYield * 100).toFixed(2);
  return {
    score,
    humanLabel: `Yield ${stockPct}% vs sector median ${sectorPct}%`,
  };
}

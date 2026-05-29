// Buy A3 — DCF intrinsic value vs current price. Positive gap = undervalued.
// For non-US tickers FMP's DCF formula uses 3yr S&P500-relative beta which
// is less meaningful; flagged as softSignal so the composer can apply half
// weight per the spec's degradation matrix.

import type { SignalResult } from "./a1-yield-percentile";

export interface A3Inputs {
  intrinsic: number;
  price: number;
  isUs: boolean;
}

export interface A3Result extends SignalResult {
  softSignal: boolean;
}

export function computeA3DcfGap(inputs: A3Inputs): A3Result {
  if (inputs.intrinsic <= 0 || inputs.price <= 0) {
    return {
      score: null,
      humanLabel: "DCF intrinsic value not available",
      softSignal: !inputs.isUs,
    };
  }
  const gap = (inputs.intrinsic - inputs.price) / inputs.price;
  const raw = 50 + gap * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const direction = gap >= 0 ? "above" : "below";
  return {
    score,
    humanLabel: `DCF intrinsic ${Math.abs(gap * 100).toFixed(0)}% ${direction} current price`,
    softSignal: !inputs.isUs,
  };
}

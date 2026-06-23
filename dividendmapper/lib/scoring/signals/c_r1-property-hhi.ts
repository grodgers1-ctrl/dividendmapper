// C_R1 — US REIT property-type Herfindahl-Hirschman Index of revenue.
// HHI = sum of (share_i × 100)² for each segment share expressed as a decimal.
// Range 0..10000 (single-segment monopoly = 10000). FMP exposes property-type
// segmentation under revenue-product-segmentation for most US REITs; empty or
// missing data cascades (null) so redistribute-weights.ts reallocates.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface CR1Inputs {
  segmentShares: number[]; // decimals; caller normalises to sum 1.0
}

export function computeCR1PropertyHhi(inputs: CR1Inputs): SignalResult {
  if (inputs.segmentShares.length === 0) {
    return { score: null, humanLabel: "segment data unavailable" };
  }
  let hhi = 0;
  for (const share of inputs.segmentShares) {
    const pct = share * 100;
    hhi += pct * pct;
  }
  let score: number;
  if (hhi <= 1500) score = 100;
  else if (hhi <= 2500) score = 75;
  else if (hhi <= 4000) score = 50;
  else if (hhi <= 6000) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `Property HHI ${Math.round(hhi)}`,
  };
}

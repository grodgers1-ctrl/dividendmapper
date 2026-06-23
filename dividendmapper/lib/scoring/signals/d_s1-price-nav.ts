// D_S1 — Current price-to-NAV-per-share z-score vs trailing 5y rolling ratio.
// Negative z-score = price below historical average vs NAV = "discount" =
// bullish for income holdings (cheap entry). Positive z = premium = bearish.
//
// Caller is responsible for building ratioHistory from prior closes ÷ prior
// NAV-per-share snapshots (nearest period to each price date).

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface DS1Inputs {
  currentPrice: number;
  navPerShare: number;
  ratioHistory: number[];
}

const MIN_HISTORY = 60;

export function computeDS1PriceNav(inputs: DS1Inputs): SignalResult {
  if (inputs.navPerShare <= 0) {
    return { score: null, humanLabel: "NAV per share unavailable" };
  }
  const currentRatio = inputs.currentPrice / inputs.navPerShare;
  if (inputs.ratioHistory.length < MIN_HISTORY) {
    return {
      score: 50,
      humanLabel: `insufficient history (${inputs.ratioHistory.length}/${MIN_HISTORY} observations)`,
    };
  }
  const n = inputs.ratioHistory.length;
  const mean = inputs.ratioHistory.reduce((s, v) => s + v, 0) / n;
  const variance = inputs.ratioHistory.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) {
    return { score: 50, humanLabel: "ratio constant — no dispersion" };
  }
  const z = (currentRatio - mean) / stdev;
  // -2σ → 100 (deeply discounted), 0σ → 50 (fair), +2σ → 0 (premium)
  const raw = 50 - 25 * z;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const tag = z < -0.25 ? "discount" : z > 0.25 ? "premium" : "fair";
  return {
    score,
    humanLabel: `P/NAV ${currentRatio.toFixed(2)} (${z.toFixed(2)}σ ${tag})`,
  };
}

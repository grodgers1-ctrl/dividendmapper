// Q_B2 — BDC NAV-per-share trend over the last 12 quarters.
// Fits a least-squares line to nav_per_share vs quarter index; the slope
// expressed as a percent of mean NAV per quarter is the score driver.
// Positive = book is growing; persistent negative = realised credit losses
// or unrealised mark-downs eroding shareholder value.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QB2Inputs {
  navPerShareHistory: { period_end: string; nav_per_share: number }[]; // date-asc
}

const MIN_QUARTERS = 8;
const MAX_QUARTERS = 12;

export function computeQB2NavTrend(inputs: QB2Inputs): SignalResult {
  const ordered = inputs.navPerShareHistory.filter((r) => r.nav_per_share > 0);
  if (ordered.length < MIN_QUARTERS) {
    return { score: null, humanLabel: "insufficient NAV history" };
  }
  const window = ordered.slice(-MAX_QUARTERS);
  const n = window.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += window[i].nav_per_share;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (window[i].nav_per_share - meanY);
    den += dx * dx;
  }
  if (den === 0 || meanY <= 0) {
    return { score: null, humanLabel: "degenerate NAV series" };
  }
  const slope = num / den; // NAV units per quarter
  const slopePct = (slope / meanY) * 100; // percent of mean NAV per quarter
  let score: number;
  if (slopePct >= 0.5) score = 100;
  else if (slopePct >= 0) score = 75;
  else if (slopePct >= -0.5) score = 50;
  else if (slopePct >= -1.0) score = 25;
  else score = 0;
  const dir = slopePct >= 0 ? "+" : "";
  return {
    score,
    humanLabel: `NAV trend ${dir}${slopePct.toFixed(2)}%/quarter`,
  };
}

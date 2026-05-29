// R2 — FCF/dividends-paid coverage trend over up to 6 quarters. A negative
// linear-regression slope means coverage is eroding even if still above 1.0.
// Steep decline (slope < -0.05/q) → 25pts; mild (-0.05..0) → 15pts; else 0.

export interface QuarterlyCoverage {
  quarter: string; // e.g. "2026-Q1"
  fcf: number;
  dividendsPaid: number;
}

export interface R2Inputs {
  quarters: QuarterlyCoverage[]; // latest first, up to 6 quarters
}

export interface R2Result {
  points: number;
  fired: boolean;
  reason: string;
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function computeR2CoverageDeterioration(inputs: R2Inputs): R2Result {
  if (inputs.quarters.length < 4) {
    return { points: 0, fired: false, reason: "Insufficient quarterly history" };
  }
  const coverageSeries = inputs.quarters
    .slice()
    .reverse() // chronological for slope
    .map((q) => (q.dividendsPaid > 0 ? q.fcf / q.dividendsPaid : 0));
  const slope = linearSlope(coverageSeries);
  if (slope < -0.05) {
    return { points: 25, fired: true, reason: `Coverage trend ${slope.toFixed(2)}/q (steep decline)` };
  }
  if (slope < 0) {
    return { points: 15, fired: true, reason: `Coverage trend ${slope.toFixed(2)}/q (mild decline)` };
  }
  return { points: 0, fired: false, reason: "Coverage stable or improving" };
}

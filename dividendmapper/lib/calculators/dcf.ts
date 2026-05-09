/**
 * Dividend Discount Model (DDM) — branded as "DCF" for search volume.
 *
 * Two modes:
 *   - simple    : Gordon Growth (1-stage, permanent g)
 *   - advanced  : 2-stage DDM (high-growth phase + terminal)
 *
 * Day 7 ships the simple-mode UI; the advanced math is wired up here so
 * Day 8 can drop in the 2-stage UI without touching the calc layer.
 *
 * Edge handling: any cell where growth ≥ discount returns null. Components
 * render null as "—", never NaN. See planning/04-phase1-sprint.md.
 */

export type DcfMode = "simple" | "advanced";

export interface DcfInputs {
  mode: DcfMode;
  /** Most recent annual dividend per share, in this stock's currency (D₀). */
  currentDividend: number;
  /** Current quoted stock price, same currency as the dividend. */
  currentPrice: number;
  /** Required rate of return (decimal, e.g. 0.085 for 8.5%). */
  discountRate: number;
  /** Permanent growth rate, simple mode (decimal). */
  growthRate: number;
  /** High-growth rate, advanced mode (decimal). */
  phase1Growth: number;
  /** High-growth period length in years (advanced mode). */
  phase1Years: number;
  /** Long-run terminal growth rate, advanced mode (decimal). */
  terminalGrowth: number;
  /**
   * The currency in which `currentDividend` and `currentPrice` are quoted.
   * Set when a ticker is fetched (so e.g. TSLA stays in USD even when the
   * locale toggle is set to UK). null = follow the user's locale.
   */
  currency: string | null;
}

export interface DcfScenario {
  /** Intrinsic value per share. null if growth ≥ discount or inputs invalid. */
  intrinsicValue: number | null;
  /** (intrinsic − price) / price. null if either side missing. */
  vsCurrentPrice: number | null;
  /** Margin of safety = (intrinsic − price) / intrinsic. null if invalid. */
  marginOfSafety: number | null;
  /** Scenario inputs actually used (so UI can label "growth 6%, discount 7%"). */
  growth: number;
  discount: number;
}

export interface DcfDividendStreamPoint {
  year: number;
  dividend: number;
}

export interface DcfSensitivity {
  /** Row labels (decimals). */
  growthRates: number[];
  /** Column labels (decimals). */
  discountRates: number[];
  /** values[r][c] — null where g ≥ d. */
  values: (number | null)[][];
  /** Index of the base-case row (so UI can highlight it). */
  baseRow: number;
  /** Index of the base-case column. */
  baseCol: number;
}

export interface DcfDividendProjectionPoint {
  /** Year offset from today; year 0 is the latest reported dividend (D₀). */
  year: number;
  bear: number;
  base: number;
  bull: number;
}

export interface DcfResult {
  scenarios: {
    bear: DcfScenario;
    base: DcfScenario;
    bull: DcfScenario;
  };
  weighted: {
    intrinsicValue: number | null;
    vsCurrentPrice: number | null;
    marginOfSafety: number | null;
  };
  dividendStream: DcfDividendStreamPoint[];
  /** Year-by-year DPS for all three scenarios — used by the projection chart. */
  dividendProjection: DcfDividendProjectionPoint[];
  sensitivity: DcfSensitivity;
  /** Yield-on-cost at the current price = D₀ / P. null if price ≤ 0. */
  breakEvenYield: number | null;
}

const PROB_WEIGHTS = { bear: 0.25, base: 0.5, bull: 0.25 } as const;

/* ─────────────────────────────────── core formulas */

export function gordonGrowthValue(
  d0: number,
  growth: number,
  discount: number
): number | null {
  if (!Number.isFinite(d0) || d0 <= 0) return null;
  if (!Number.isFinite(growth) || !Number.isFinite(discount)) return null;
  if (growth >= discount) return null;
  return (d0 * (1 + growth)) / (discount - growth);
}

export function twoStageDDMValue(
  d0: number,
  phase1Growth: number,
  phase1Years: number,
  terminalGrowth: number,
  discount: number
): number | null {
  if (!Number.isFinite(d0) || d0 <= 0) return null;
  if (!Number.isFinite(discount)) return null;
  if (terminalGrowth >= discount) return null;
  const years = Math.max(0, Math.round(phase1Years));
  if (years === 0) return gordonGrowthValue(d0, terminalGrowth, discount);

  let pv = 0;
  let div = d0;
  for (let t = 1; t <= years; t++) {
    div *= 1 + phase1Growth;
    pv += div / Math.pow(1 + discount, t);
  }
  const terminal = (div * (1 + terminalGrowth)) / (discount - terminalGrowth);
  pv += terminal / Math.pow(1 + discount, years);
  return pv;
}

/* ─────────────────────────────────── orchestrator */

export function calculateDcf(inputs: DcfInputs): DcfResult {
  const baseGrowth = inputs.mode === "simple" ? inputs.growthRate : inputs.phase1Growth;
  const baseDiscount = inputs.discountRate;

  // Bull = +2pp growth and −1.5pp discount, but with a guard: the spread
  // (discount − growth) must stay ≥ 2pp. With user-default UK inputs (growth
  // 4%, discount 8.5%) the raw Bull lands at growth 6% / discount 7% — a 1pp
  // spread that produces an absurd intrinsic (£127 vs £24 price) and pulls
  // the probability-weighted figure with it. Clamping the spread at 2pp
  // keeps Bull genuinely optimistic without breaking the model.
  const bullGrowth = baseGrowth + 0.02;
  const bullDiscount = Math.max(
    Math.max(0.001, baseDiscount - 0.015),
    bullGrowth + 0.02
  );

  const scenarios = {
    bear: buildScenario(inputs, baseGrowth - 0.02, baseDiscount + 0.015),
    base: buildScenario(inputs, baseGrowth, baseDiscount),
    bull: buildScenario(inputs, bullGrowth, bullDiscount),
  };

  const weighted = weightScenarios(scenarios, inputs.currentPrice);
  const dividendStream = projectDividendStream(inputs, baseGrowth);
  const dividendProjection = projectDividendsAcrossScenarios(
    inputs,
    scenarios.bear,
    scenarios.base,
    scenarios.bull
  );
  const sensitivity = buildSensitivity(inputs, baseGrowth, baseDiscount);
  const breakEvenYield =
    inputs.currentPrice > 0 && inputs.currentDividend > 0
      ? inputs.currentDividend / inputs.currentPrice
      : null;

  return {
    scenarios,
    weighted,
    dividendStream,
    dividendProjection,
    sensitivity,
    breakEvenYield,
  };
}

function buildScenario(
  inputs: DcfInputs,
  growth: number,
  discount: number
): DcfScenario {
  const intrinsic = valueFor(inputs, growth, discount);
  const { currentPrice } = inputs;
  if (intrinsic === null || !(currentPrice > 0)) {
    return {
      intrinsicValue: intrinsic,
      vsCurrentPrice: null,
      marginOfSafety: null,
      growth,
      discount,
    };
  }
  return {
    intrinsicValue: intrinsic,
    vsCurrentPrice: (intrinsic - currentPrice) / currentPrice,
    marginOfSafety: (intrinsic - currentPrice) / intrinsic,
    growth,
    discount,
  };
}

function valueFor(
  inputs: DcfInputs,
  growth: number,
  discount: number
): number | null {
  if (inputs.mode === "simple") {
    return gordonGrowthValue(inputs.currentDividend, growth, discount);
  }
  return twoStageDDMValue(
    inputs.currentDividend,
    growth,
    inputs.phase1Years,
    inputs.terminalGrowth,
    discount
  );
}

function weightScenarios(
  scenarios: DcfResult["scenarios"],
  currentPrice: number
): DcfResult["weighted"] {
  // Probability-weight only the scenarios that produced a valid intrinsic
  // value, then re-normalise. If all three are invalid, return nulls.
  const parts: [number | null, number][] = [
    [scenarios.bear.intrinsicValue, PROB_WEIGHTS.bear],
    [scenarios.base.intrinsicValue, PROB_WEIGHTS.base],
    [scenarios.bull.intrinsicValue, PROB_WEIGHTS.bull],
  ];
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [v, w] of parts) {
    if (v !== null && Number.isFinite(v)) {
      weightedSum += v * w;
      totalWeight += w;
    }
  }
  if (totalWeight === 0) {
    return { intrinsicValue: null, vsCurrentPrice: null, marginOfSafety: null };
  }
  const intrinsic = weightedSum / totalWeight;
  if (!(currentPrice > 0)) {
    return { intrinsicValue: intrinsic, vsCurrentPrice: null, marginOfSafety: null };
  }
  return {
    intrinsicValue: intrinsic,
    vsCurrentPrice: (intrinsic - currentPrice) / currentPrice,
    marginOfSafety: (intrinsic - currentPrice) / intrinsic,
  };
}

function projectDividendsAcrossScenarios(
  inputs: DcfInputs,
  bear: DcfScenario,
  base: DcfScenario,
  bull: DcfScenario
): DcfDividendProjectionPoint[] {
  const out: DcfDividendProjectionPoint[] = [];
  const d0 = inputs.currentDividend;
  if (!(d0 > 0)) return out;
  // Year 0 anchor — all three scenarios start at the latest reported
  // dividend, then fan out as growth differences compound.
  out.push({ year: 0, bear: d0, base: d0, bull: d0 });
  let bearD = d0;
  let baseD = d0;
  let bullD = d0;
  // 15 years is the sweet spot: long enough to make the cone of uncertainty
  // visible, short enough that the chart stays legible on mobile.
  for (let y = 1; y <= 15; y++) {
    bearD *= 1 + bear.growth;
    baseD *= 1 + base.growth;
    bullD *= 1 + bull.growth;
    out.push({ year: y, bear: bearD, base: baseD, bull: bullD });
  }
  return out;
}

function projectDividendStream(
  inputs: DcfInputs,
  baseGrowth: number
): DcfDividendStreamPoint[] {
  const points: DcfDividendStreamPoint[] = [];
  let div = inputs.currentDividend;
  if (!(div > 0)) return points;
  for (let y = 1; y <= 10; y++) {
    if (inputs.mode === "advanced" && y > Math.round(inputs.phase1Years)) {
      div *= 1 + inputs.terminalGrowth;
    } else {
      div *= 1 + baseGrowth;
    }
    points.push({ year: y, dividend: div });
  }
  return points;
}

function buildSensitivity(
  inputs: DcfInputs,
  baseGrowth: number,
  baseDiscount: number
): DcfSensitivity {
  // 5 × 5 grid centred on the base case, ±2pp at 1pp steps.
  const growthRates = centeredRange(baseGrowth, 5, 0.01);
  const discountRates = centeredRange(baseDiscount, 5, 0.01);
  const values = growthRates.map((g) =>
    discountRates.map((d) => valueFor(inputs, g, d))
  );
  return {
    growthRates,
    discountRates,
    values,
    baseRow: Math.floor(growthRates.length / 2),
    baseCol: Math.floor(discountRates.length / 2),
  };
}

function centeredRange(center: number, count: number, step: number): number[] {
  const half = Math.floor(count / 2);
  const out: number[] = [];
  for (let i = -half; i <= count - 1 - half; i++) {
    out.push(roundDecimal(center + i * step));
  }
  return out;
}

function roundDecimal(v: number): number {
  // Avoid floating-point fuzz like 0.06000000001 in the table headers.
  return Math.round(v * 1e6) / 1e6;
}

/* ─────────────────────────────────── margin-of-safety classification */

export type MosBand = "attractive" | "fair" | "overvalued" | "unknown";

/**
 * Classify a margin-of-safety value into a colour band:
 *   > 20%   → attractive (brand green)
 *   0–20%   → fair       (amber)
 *   < 0%    → overvalued (red)
 *   null    → unknown    (neutral)
 *
 * The 0–5% band is bundled into "fair" rather than its own colour — the spec
 * lists three thresholds and 0–5% has no separate visual treatment.
 */
export function classifyMos(mos: number | null): MosBand {
  if (mos === null || !Number.isFinite(mos)) return "unknown";
  if (mos > 0.2) return "attractive";
  if (mos >= 0) return "fair";
  return "overvalued";
}

import type { Locale } from "@/lib/locale/types";

export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  currentPortfolio: number;
  monthlyContribution: number;
  /** decimal e.g. 0.07 for 7% */
  annualReturn: number;
  /** decimal e.g. 0.04 for 4% */
  dividendYield: number;
  reinvestDividends: boolean;
  targetMonthlyIncome: number;

  /** Age at which the state benefit (UK State Pension / US Social Security) starts paying. */
  statePensionAge: number;

  // UK-only
  isaAllocation?: number; // decimal 0–1 (share of monthly contributions)
  sippAllocation?: number; // decimal 0–1
  includeStatePension?: boolean;
  /** Per-week pension figure, in GBP. Multiplied to monthly internally. */
  statePensionWeekly?: number;

  // UK lump sum (25% tax-free at access age, capped at LSA)
  /** Whether to take the 25% tax-free lump sum at retirement. UK only. */
  takeLumpSum?: boolean;
  /** Share of lump sum reinvested into a GIA (stays earning at the user's yield). 0–1. */
  lumpSumReinvestPct?: number;
  /** Share of lump sum used to pay down mortgage/debt (removed from portfolio). 0–1. */
  lumpSumMortgagePct?: number;
  /** Share of lump sum taken as cash for spending (removed from portfolio). 0–1. */
  lumpSumCashPct?: number;

  // Property & other non-investment assets — tracked for net worth, not folded
  // into FIRE income unless they generate cash (rental income).
  /** Current equity in main residence (you can't spend it but it's part of net worth). */
  mainResidenceEquity?: number;
  /** Annual % growth assumed for property values (decimal). */
  propertyGrowthRate?: number;
  /** Equity in buy-to-let / rental property. Generates rental income and capital growth. */
  buyToLetEquity?: number;
  /** Net monthly rental income (after costs). Flows into retirement income. */
  buyToLetMonthlyRent?: number;
  /** Other assets (business equity, cash, collectibles) — net worth display only. */
  otherAssetsValue?: number;

  // US-only
  monthlyK401?: number;
  annualIRA?: number;
  includeSocialSecurity?: boolean;
  socialSecurityMonthly?: number;
}

export type ScenarioKey = "bear" | "base" | "bull";

export interface ScenarioParams {
  /** Annual portfolio return (decimal) */
  annualReturn: number;
  /** Yield at retirement (decimal) */
  dividendYield: number;
}

export interface ProjectionPoint {
  age: number;
  year: number;
  bear: number;
  base: number;
  bull: number;
  weighted: number;
}

export interface WrapperBreakdown {
  isa: number;
  sipp: number;
  gia: number;
}

export interface LumpSumBreakdown {
  /** Gross 25% (uncapped) — what the user would get without LSA. */
  grossEligible: number;
  /** Capped at the Lump Sum Allowance (£268,275 for UK). */
  taken: number;
  /** Of `taken`: portion the user chose to reinvest in a GIA. */
  reinvested: number;
  /** Of `taken`: portion used to pay down mortgage/debt (leaves portfolio). */
  toMortgage: number;
  /** Of `taken`: portion taken as cash for spending (leaves portfolio). */
  toCash: number;
}

export interface ScenarioResult {
  /** Gross portfolio at retirement (before any lump-sum decisions). */
  portfolioAtRetirement: number;
  /** Per-wrapper portfolio at retirement. UK locale: meaningful split. US: everything in `gia`. */
  wrappers: WrapperBreakdown;
  /** Lump sum breakdown (UK only — zero values for US). */
  lumpSum: LumpSumBreakdown;
  /** Effective portfolio after lump-sum decisions (mortgage + cash removed; reinvested still in). */
  effectivePortfolio: number;
  annualDividendIncome: number;
  monthlyDividendIncome: number;
  /** Difference between scenario monthly income and target (after state benefit credit) */
  vsTarget: number;
  /** Years from current age until portfolio crosses the FIRE number */
  yearsToFire: number | null;
}

export interface PropertySnapshot {
  /** Main residence equity grown to retirement age. NOT counted in FIRE income. */
  mainResidenceAtRetirement: number;
  /** Buy-to-let equity grown to retirement age. */
  buyToLetAtRetirement: number;
  /** Net monthly rental income at retirement (assumed flat in real terms). */
  rentalMonthly: number;
  /** Other assets — passed through unchanged. */
  otherAssets: number;
  /** Total non-investment net worth at retirement (excludes the dividend portfolio). */
  totalAtRetirement: number;
}

export interface RetirementResult {
  /** Portfolio needed at retirement age to cover the binding income phase. */
  fireNumber: number;
  /** State Pension / Social Security monthly amount, once it starts paying. */
  benefitMonthly: number;
  /** Target the portfolio must cover before the state benefit starts (= full target). */
  portfolioTargetMonthly: number;
  /** Target the portfolio must cover after the state benefit starts (target − benefit, ≥ 0). */
  portfolioTargetAfterBenefit: number;
  /** Years between retirement age and state benefit start age (≥ 0). */
  bridgeYears: number;
  /** True if the user retires before the state benefit starts. */
  hasBridgePhase: boolean;
  yearsToRetirement: number;
  scenarios: Record<ScenarioKey, ScenarioResult>;
  weighted: ScenarioResult;
  projection: ProjectionPoint[];
  /** Property and other assets, projected to retirement age. */
  property: PropertySnapshot;
}

const SCENARIO_WEIGHTS: Record<ScenarioKey, number> = {
  bear: 0.25,
  base: 0.5,
  bull: 0.25,
};

/**
 * Adjust the user's base assumptions to derive Bear and Bull scenarios.
 * Per spec: Bear = return−2pp / yield−1pp, Bull = return+2pp / yield+1pp.
 * Floors return at 0% and yield at 0.5% so charts don't collapse.
 */
export function deriveScenarios(
  annualReturn: number,
  dividendYield: number
): Record<ScenarioKey, ScenarioParams> {
  return {
    bear: {
      annualReturn: Math.max(0, annualReturn - 0.02),
      dividendYield: Math.max(0.005, dividendYield - 0.01),
    },
    base: { annualReturn, dividendYield },
    bull: {
      annualReturn: annualReturn + 0.02,
      dividendYield: dividendYield + 0.01,
    },
  };
}

/**
 * Project a portfolio value year-by-year. Contributions made monthly, growth
 * compounded monthly, dividends optionally reinvested. Returns one point per
 * year (length = years + 1, index 0 = starting value).
 */
export function projectPortfolio(
  years: number,
  startValue: number,
  monthlyContribution: number,
  annualReturn: number,
  dividendYield: number,
  reinvest: boolean
): number[] {
  const monthlyReturn = annualReturn / 12;
  const monthlyYield = dividendYield / 12;
  const values: number[] = [startValue];
  let portfolio = startValue;

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      const growth = portfolio * monthlyReturn;
      const dividends = portfolio * monthlyYield;
      portfolio += monthlyContribution + growth;
      if (reinvest) portfolio += dividends;
    }
    values.push(portfolio);
  }
  return values;
}

interface WrapperSplit {
  /** Initial value in this wrapper. */
  start: number;
  /** Monthly contribution flowing into this wrapper. */
  monthly: number;
}

interface WrapperSplits {
  isa: WrapperSplit;
  sipp: WrapperSplit;
  gia: WrapperSplit;
}

interface LumpSumConfig {
  enabled: boolean;
  cap: number | null;
  reinvestPct: number;
  mortgagePct: number;
  cashPct: number;
}

function buildScenarioResult(
  splits: WrapperSplits,
  yearsToRetirement: number,
  params: ScenarioParams,
  reinvest: boolean,
  fireNumber: number,
  portfolioTargetMonthly: number,
  lumpSum: LumpSumConfig
): { result: ScenarioResult; values: number[] } {
  // Project each wrapper independently. Same return and yield assumptions
  // apply to all wrappers (we don't model wrapper-specific yields yet — that's
  // a Phase 2 refinement).
  const isaValues = projectPortfolio(
    yearsToRetirement,
    splits.isa.start,
    splits.isa.monthly,
    params.annualReturn,
    params.dividendYield,
    reinvest
  );
  const sippValues = projectPortfolio(
    yearsToRetirement,
    splits.sipp.start,
    splits.sipp.monthly,
    params.annualReturn,
    params.dividendYield,
    reinvest
  );
  const giaValues = projectPortfolio(
    yearsToRetirement,
    splits.gia.start,
    splits.gia.monthly,
    params.annualReturn,
    params.dividendYield,
    reinvest
  );

  const last = (arr: number[]) => arr[arr.length - 1] ?? 0;
  const wrappers: WrapperBreakdown = {
    isa: last(isaValues),
    sipp: last(sippValues),
    gia: last(giaValues),
  };
  const portfolioAtRetirement = wrappers.isa + wrappers.sipp + wrappers.gia;

  // Lump sum: UK-only, 25% of SIPP capped at LSA. Allocation splits decide
  // what stays in the portfolio vs what leaves.
  const grossEligible = lumpSum.enabled ? wrappers.sipp * 0.25 : 0;
  const taken = lumpSum.cap !== null
    ? Math.min(grossEligible, lumpSum.cap)
    : grossEligible;
  const lumpSumBreakdown: LumpSumBreakdown = {
    grossEligible,
    taken,
    reinvested: taken * lumpSum.reinvestPct,
    toMortgage: taken * lumpSum.mortgagePct,
    toCash: taken * lumpSum.cashPct,
  };

  // Effective portfolio = pre-lump-sum total minus what leaves (mortgage + cash).
  // Reinvested portion stays in the portfolio (now in a GIA wrapper, but we
  // don't model wrapper-specific yields yet so we just leave it in the total).
  const removed = lumpSumBreakdown.toMortgage + lumpSumBreakdown.toCash;
  const effectivePortfolio = portfolioAtRetirement - removed;

  const annualDividendIncome = effectivePortfolio * params.dividendYield;
  const monthlyDividendIncome = annualDividendIncome / 12;
  const vsTarget = monthlyDividendIncome - portfolioTargetMonthly;

  // Total portfolio path for the chart and FIRE crossover detection.
  const values: number[] = [];
  for (let i = 0; i < isaValues.length; i++) {
    values.push(
      (isaValues[i] ?? 0) + (sippValues[i] ?? 0) + (giaValues[i] ?? 0)
    );
  }

  let yearsToFire: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] >= fireNumber) {
      yearsToFire = i;
      break;
    }
  }
  if (yearsToFire === null) {
    const totalMonthly =
      splits.isa.monthly + splits.sipp.monthly + splits.gia.monthly;
    const extension = projectPortfolio(
      50,
      portfolioAtRetirement,
      totalMonthly,
      params.annualReturn,
      params.dividendYield,
      reinvest
    );
    for (let i = 1; i < extension.length; i++) {
      if (extension[i] >= fireNumber) {
        yearsToFire = yearsToRetirement + i;
        break;
      }
    }
  }

  return {
    values,
    result: {
      portfolioAtRetirement,
      wrappers,
      lumpSum: lumpSumBreakdown,
      effectivePortfolio,
      annualDividendIncome,
      monthlyDividendIncome,
      vsTarget,
      yearsToFire,
    },
  };
}

/**
 * Run the full retirement projection across Bear/Base/Bull scenarios and
 * return everything the UI needs to render.
 */
export function calculateRetirement(
  inputs: RetirementInputs,
  locale: Locale
): RetirementResult {
  const yearsToRetirement = Math.max(
    0,
    Math.floor(inputs.retirementAge - inputs.currentAge)
  );

  // State benefit (UK State Pension / US Social Security) — kicks in at SPA.
  let benefitMonthly = 0;
  if (locale === "uk" && inputs.includeStatePension) {
    const weekly = inputs.statePensionWeekly ?? 0;
    benefitMonthly = (weekly * 52) / 12;
  } else if (locale === "us" && inputs.includeSocialSecurity) {
    benefitMonthly = inputs.socialSecurityMonthly ?? 0;
  }

  // Rental income — independent of SPA. Available from day 1 of retirement
  // (assumed flat in nominal terms — refine in Phase 2 if users ask).
  const rentalMonthly = Math.max(0, inputs.buyToLetMonthlyRent ?? 0);

  // Bridge phase: years between retirement and state benefit kicking in.
  const bridgeYears = Math.max(
    0,
    inputs.statePensionAge - inputs.retirementAge
  );
  const hasBridgePhase = bridgeYears > 0 && benefitMonthly > 0;

  // Phase targets (what the *dividend portfolio* alone must produce). Rental
  // income offsets the target in BOTH phases; state benefit only in Phase 2.
  //   Phase 1 (RA → SPA): target − rental
  //   Phase 2 (SPA+):     target − rental − benefit
  const portfolioTargetMonthly = hasBridgePhase
    ? Math.max(0, inputs.targetMonthlyIncome - rentalMonthly)
    : Math.max(0, inputs.targetMonthlyIncome - rentalMonthly - benefitMonthly);
  const portfolioTargetAfterBenefit = Math.max(
    0,
    inputs.targetMonthlyIncome - rentalMonthly - benefitMonthly
  );

  // FIRE = portfolio needed to throw off the *binding* phase target as a
  // perpetuity at the user's yield. The bridge phase is binding when present
  // because that's when the portfolio carries the load alone.
  const safeYield = Math.max(0.005, inputs.dividendYield);
  const fireNumber = (portfolioTargetMonthly * 12) / safeYield;

  const scenarioParams = deriveScenarios(
    inputs.annualReturn,
    inputs.dividendYield
  );

  // Per-wrapper allocation. UK uses ISA/SIPP/GIA shares (with GIA = remainder).
  // US (and any locale without explicit splits) puts everything in `gia` so the
  // total math is unchanged.
  const splits = buildWrapperSplits(inputs, locale);
  const lumpSumConfig = buildLumpSumConfig(inputs, locale);

  const buildOne = (key: ScenarioKey) =>
    buildScenarioResult(
      splits,
      yearsToRetirement,
      scenarioParams[key],
      inputs.reinvestDividends,
      fireNumber,
      portfolioTargetMonthly,
      lumpSumConfig
    );

  const bear = buildOne("bear");
  const base = buildOne("base");
  const bull = buildOne("bull");

  const projection: ProjectionPoint[] = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i <= yearsToRetirement; i++) {
    const bearV = bear.values[i] ?? 0;
    const baseV = base.values[i] ?? 0;
    const bullV = bull.values[i] ?? 0;
    projection.push({
      age: inputs.currentAge + i,
      year: currentYear + i,
      bear: bearV,
      base: baseV,
      bull: bullV,
      weighted:
        bearV * SCENARIO_WEIGHTS.bear +
        baseV * SCENARIO_WEIGHTS.base +
        bullV * SCENARIO_WEIGHTS.bull,
    });
  }

  const weighted: ScenarioResult = {
    portfolioAtRetirement: weightedAvg(
      bear.result.portfolioAtRetirement,
      base.result.portfolioAtRetirement,
      bull.result.portfolioAtRetirement
    ),
    wrappers: {
      isa: weightedAvg(
        bear.result.wrappers.isa,
        base.result.wrappers.isa,
        bull.result.wrappers.isa
      ),
      sipp: weightedAvg(
        bear.result.wrappers.sipp,
        base.result.wrappers.sipp,
        bull.result.wrappers.sipp
      ),
      gia: weightedAvg(
        bear.result.wrappers.gia,
        base.result.wrappers.gia,
        bull.result.wrappers.gia
      ),
    },
    lumpSum: {
      grossEligible: weightedAvg(
        bear.result.lumpSum.grossEligible,
        base.result.lumpSum.grossEligible,
        bull.result.lumpSum.grossEligible
      ),
      taken: weightedAvg(
        bear.result.lumpSum.taken,
        base.result.lumpSum.taken,
        bull.result.lumpSum.taken
      ),
      reinvested: weightedAvg(
        bear.result.lumpSum.reinvested,
        base.result.lumpSum.reinvested,
        bull.result.lumpSum.reinvested
      ),
      toMortgage: weightedAvg(
        bear.result.lumpSum.toMortgage,
        base.result.lumpSum.toMortgage,
        bull.result.lumpSum.toMortgage
      ),
      toCash: weightedAvg(
        bear.result.lumpSum.toCash,
        base.result.lumpSum.toCash,
        bull.result.lumpSum.toCash
      ),
    },
    effectivePortfolio: weightedAvg(
      bear.result.effectivePortfolio,
      base.result.effectivePortfolio,
      bull.result.effectivePortfolio
    ),
    annualDividendIncome: weightedAvg(
      bear.result.annualDividendIncome,
      base.result.annualDividendIncome,
      bull.result.annualDividendIncome
    ),
    monthlyDividendIncome: weightedAvg(
      bear.result.monthlyDividendIncome,
      base.result.monthlyDividendIncome,
      bull.result.monthlyDividendIncome
    ),
    vsTarget: weightedAvg(
      bear.result.vsTarget,
      base.result.vsTarget,
      bull.result.vsTarget
    ),
    yearsToFire: weightedYears(
      bear.result.yearsToFire,
      base.result.yearsToFire,
      bull.result.yearsToFire
    ),
  };

  // Property snapshot — grow main residence + buy-to-let by propertyGrowthRate
  // until retirement age. Rental income assumed flat (a defensible
  // simplification — fold real-rental-growth in Phase 2 if users ask).
  const propertyGrowth = Math.max(0, inputs.propertyGrowthRate ?? 0);
  const propertyMultiplier = Math.pow(1 + propertyGrowth, yearsToRetirement);
  const mainResidenceAtRetirement =
    Math.max(0, inputs.mainResidenceEquity ?? 0) * propertyMultiplier;
  const buyToLetAtRetirement =
    Math.max(0, inputs.buyToLetEquity ?? 0) * propertyMultiplier;
  const otherAssets = Math.max(0, inputs.otherAssetsValue ?? 0);
  const property: PropertySnapshot = {
    mainResidenceAtRetirement,
    buyToLetAtRetirement,
    rentalMonthly,
    otherAssets,
    totalAtRetirement:
      mainResidenceAtRetirement + buyToLetAtRetirement + otherAssets,
  };

  return {
    fireNumber,
    benefitMonthly,
    portfolioTargetMonthly,
    portfolioTargetAfterBenefit,
    bridgeYears,
    hasBridgePhase,
    yearsToRetirement,
    scenarios: { bear: bear.result, base: base.result, bull: bull.result },
    weighted,
    projection,
    property,
  };
}

function weightedAvg(bear: number, base: number, bull: number): number {
  return (
    bear * SCENARIO_WEIGHTS.bear +
    base * SCENARIO_WEIGHTS.base +
    bull * SCENARIO_WEIGHTS.bull
  );
}

function buildWrapperSplits(
  inputs: RetirementInputs,
  locale: Locale
): WrapperSplits {
  // Wrapper slot semantics (kept as isa/sipp/gia for backward compatibility,
  // but they really mean "tax-free / tax-deferred / taxable"):
  //   UK  → ISA / SIPP / GIA
  //   US  → IRA (or Roth) / 401(k) / Brokerage
  if (locale === "us") {
    // US — three independent contribution streams. monthlyContribution acts as
    // the brokerage/taxable bucket; 401(k) and IRA inputs sit alongside.
    const monthlySipp = Math.max(0, inputs.monthlyK401 ?? 0);
    const monthlyIsa = Math.max(0, (inputs.annualIRA ?? 0) / 12);
    const monthlyGia = Math.max(0, inputs.monthlyContribution);

    // Split current portfolio in the same proportions as monthly contributions
    // (defensible default — users with a different actual split can adjust the
    // current-portfolio input). If contributions are all zero, drop everything
    // into the brokerage bucket since that's the most flexible wrapper to model.
    const totalMonthly = monthlySipp + monthlyIsa + monthlyGia;
    const sippShare = totalMonthly > 0 ? monthlySipp / totalMonthly : 0;
    const isaShare = totalMonthly > 0 ? monthlyIsa / totalMonthly : 0;
    const giaShare = totalMonthly > 0 ? monthlyGia / totalMonthly : 1;

    return {
      isa: {
        start: inputs.currentPortfolio * isaShare,
        monthly: monthlyIsa,
      },
      sipp: {
        start: inputs.currentPortfolio * sippShare,
        monthly: monthlySipp,
      },
      gia: {
        start: inputs.currentPortfolio * giaShare,
        monthly: monthlyGia,
      },
    };
  }

  // UK — split by allocation slider. We assume the *current* portfolio is
  // already split by the same allocation (defensible default; users with
  // different actual splits can adjust their current portfolio input).
  const isaPct = clamp01(inputs.isaAllocation ?? 0);
  const sippPct = clamp01(inputs.sippAllocation ?? 0);
  const giaPct = Math.max(0, 1 - isaPct - sippPct);

  return {
    isa: {
      start: inputs.currentPortfolio * isaPct,
      monthly: inputs.monthlyContribution * isaPct,
    },
    sipp: {
      start: inputs.currentPortfolio * sippPct,
      monthly: inputs.monthlyContribution * sippPct,
    },
    gia: {
      start: inputs.currentPortfolio * giaPct,
      monthly: inputs.monthlyContribution * giaPct,
    },
  };
}

function buildLumpSumConfig(
  inputs: RetirementInputs,
  locale: Locale
): LumpSumConfig {
  if (locale !== "uk" || !inputs.takeLumpSum) {
    return {
      enabled: false,
      cap: null,
      reinvestPct: 1,
      mortgagePct: 0,
      cashPct: 0,
    };
  }
  // Normalise the three pcts so they always sum to 1. If user has set them all
  // to zero (no allocation), default to 100% reinvest so the lump sum stays in.
  const r = Math.max(0, inputs.lumpSumReinvestPct ?? 1);
  const m = Math.max(0, inputs.lumpSumMortgagePct ?? 0);
  const c = Math.max(0, inputs.lumpSumCashPct ?? 0);
  const sum = r + m + c;
  const norm = sum > 0
    ? { r: r / sum, m: m / sum, c: c / sum }
    : { r: 1, m: 0, c: 0 };
  return {
    enabled: true,
    cap: 268275, // UK Lump Sum Allowance — keep in sync with locale config
    reinvestPct: norm.r,
    mortgagePct: norm.m,
    cashPct: norm.c,
  };
}

function clamp01(v: number): number {
  if (Number.isNaN(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function weightedYears(
  bear: number | null,
  base: number | null,
  bull: number | null
): number | null {
  if (bear === null || base === null || bull === null) return null;
  return (
    bear * SCENARIO_WEIGHTS.bear +
    base * SCENARIO_WEIGHTS.base +
    bull * SCENARIO_WEIGHTS.bull
  );
}

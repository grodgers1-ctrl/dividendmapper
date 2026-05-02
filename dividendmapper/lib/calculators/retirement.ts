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

  // UK-only
  isaAllocation?: number; // decimal 0–1 (share of monthly contributions)
  sippAllocation?: number; // decimal 0–1
  includeStatePension?: boolean;
  /** Per-week pension figure, in GBP. Multiplied to monthly internally. */
  statePensionWeekly?: number;

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

export interface ScenarioResult {
  portfolioAtRetirement: number;
  annualDividendIncome: number;
  monthlyDividendIncome: number;
  /** Difference between scenario monthly income and target (after state benefit credit) */
  vsTarget: number;
  /** Years from current age until portfolio crosses the FIRE number */
  yearsToFire: number | null;
}

export interface RetirementResult {
  fireNumber: number;
  /** State Pension / Social Security monthly contribution credited towards target */
  benefitMonthly: number;
  /** Target monthly income from the *portfolio* alone (target − benefit, ≥ 0) */
  portfolioTargetMonthly: number;
  yearsToRetirement: number;
  scenarios: Record<ScenarioKey, ScenarioResult>;
  weighted: ScenarioResult;
  projection: ProjectionPoint[];
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

function buildScenarioResult(
  startValue: number,
  yearsToRetirement: number,
  monthlyContribution: number,
  params: ScenarioParams,
  reinvest: boolean,
  fireNumber: number,
  portfolioTargetMonthly: number
): { result: ScenarioResult; values: number[] } {
  const values = projectPortfolio(
    yearsToRetirement,
    startValue,
    monthlyContribution,
    params.annualReturn,
    params.dividendYield,
    reinvest
  );
  const portfolioAtRetirement = values[values.length - 1] ?? startValue;
  const annualDividendIncome = portfolioAtRetirement * params.dividendYield;
  const monthlyDividendIncome = annualDividendIncome / 12;
  const vsTarget = monthlyDividendIncome - portfolioTargetMonthly;

  let yearsToFire: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] >= fireNumber) {
      yearsToFire = i;
      break;
    }
  }
  // If FIRE not hit within the projection window, project forward up to a
  // generous cap (50 more years) so the table can show a meaningful answer.
  if (yearsToFire === null) {
    const extension = projectPortfolio(
      50,
      portfolioAtRetirement,
      monthlyContribution,
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

  // Credit benefits towards the user's target *only* if they're enabled.
  let benefitMonthly = 0;
  if (locale === "uk" && inputs.includeStatePension) {
    const weekly = inputs.statePensionWeekly ?? 0;
    benefitMonthly = (weekly * 52) / 12;
  } else if (locale === "us" && inputs.includeSocialSecurity) {
    benefitMonthly = inputs.socialSecurityMonthly ?? 0;
  }

  const portfolioTargetMonthly = Math.max(
    0,
    inputs.targetMonthlyIncome - benefitMonthly
  );

  // FIRE number is the portfolio you need to throw off the *remaining* target
  // at the user's expected yield. Guard against zero yield.
  const safeYield = Math.max(0.005, inputs.dividendYield);
  const fireNumber = (portfolioTargetMonthly * 12) / safeYield;

  const scenarioParams = deriveScenarios(
    inputs.annualReturn,
    inputs.dividendYield
  );

  const buildOne = (key: ScenarioKey) =>
    buildScenarioResult(
      inputs.currentPortfolio,
      yearsToRetirement,
      inputs.monthlyContribution,
      scenarioParams[key],
      inputs.reinvestDividends,
      fireNumber,
      portfolioTargetMonthly
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

  return {
    fireNumber,
    benefitMonthly,
    portfolioTargetMonthly,
    yearsToRetirement,
    scenarios: { bear: bear.result, base: base.result, bull: bull.result },
    weighted,
    projection,
  };
}

function weightedAvg(bear: number, base: number, bull: number): number {
  return (
    bear * SCENARIO_WEIGHTS.bear +
    base * SCENARIO_WEIGHTS.base +
    bull * SCENARIO_WEIGHTS.bull
  );
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

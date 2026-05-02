"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import {
  calculateRetirement,
  type RetirementInputs,
} from "@/lib/calculators/retirement";
import { InputsPanel } from "./inputs-panel";
import { FireCard } from "./fire-card";
import { LumpSumCard } from "./lump-sum-card";
import { NetWorthCard } from "./net-worth-card";
import { ProjectionChart } from "./projection-chart";
import { ScenariosTable } from "./scenarios-table";

const UK_DEFAULTS: RetirementInputs = {
  currentAge: 30,
  retirementAge: 55,
  currentPortfolio: 0,
  monthlyContribution: 500,
  annualReturn: 0.07,
  dividendYield: 0.04,
  reinvestDividends: true,
  targetMonthlyIncome: 3000,
  statePensionAge: 67,
  isaAllocation: 0.8,
  sippAllocation: 0.2,
  includeStatePension: true,
  statePensionWeekly: 241.3, // 2026/27 full new State Pension
  takeLumpSum: true,
  lumpSumReinvestPct: 1, // Default: leave it all invested
  lumpSumMortgagePct: 0,
  lumpSumCashPct: 0,
  propertyGrowthRate: 0.02, // UK long-run real ≈ 2%
};

const US_DEFAULTS: RetirementInputs = {
  currentAge: 30,
  retirementAge: 55,
  currentPortfolio: 0,
  monthlyContribution: 800,
  annualReturn: 0.07,
  dividendYield: 0.04,
  reinvestDividends: true,
  targetMonthlyIncome: 5000,
  statePensionAge: 67,
  monthlyK401: 2042,
  annualIRA: 7500,
  includeSocialSecurity: true,
  socialSecurityMonthly: 2071, // 2026 average retired-worker benefit
  propertyGrowthRate: 0.03, // US long-run nominal ≈ 3%
};

export function RetirementCalculator() {
  const { config } = useLocale();
  const [inputs, setInputs] = React.useState<RetirementInputs>(UK_DEFAULTS);

  // When the locale flips, swap to that locale's default target income +
  // benefit fields. Preserve the user's portfolio numbers (they're locale-
  // agnostic) so a UK-built scenario doesn't reset on a US toggle.
  const lastLocaleRef = React.useRef(config.locale);
  React.useEffect(() => {
    if (lastLocaleRef.current === config.locale) return;
    const defaults = config.locale === "uk" ? UK_DEFAULTS : US_DEFAULTS;
    setInputs((prev) => ({
      ...prev,
      targetMonthlyIncome: defaults.targetMonthlyIncome,
      statePensionAge: defaults.statePensionAge,
      isaAllocation: defaults.isaAllocation,
      sippAllocation: defaults.sippAllocation,
      includeStatePension: defaults.includeStatePension,
      statePensionWeekly: defaults.statePensionWeekly,
      takeLumpSum: defaults.takeLumpSum,
      lumpSumReinvestPct: defaults.lumpSumReinvestPct,
      lumpSumMortgagePct: defaults.lumpSumMortgagePct,
      lumpSumCashPct: defaults.lumpSumCashPct,
      monthlyK401: defaults.monthlyK401,
      annualIRA: defaults.annualIRA,
      includeSocialSecurity: defaults.includeSocialSecurity,
      socialSecurityMonthly: defaults.socialSecurityMonthly,
      propertyGrowthRate: defaults.propertyGrowthRate,
    }));
    lastLocaleRef.current = config.locale;
  }, [config.locale]);

  const result = React.useMemo(
    () => calculateRetirement(inputs, config.locale),
    [inputs, config.locale]
  );

  return (
    <div className="space-y-6">
      <InputsPanel inputs={inputs} setInputs={setInputs} />
      <FireCard
        result={result}
        currentPortfolio={inputs.currentPortfolio}
        targetMonthlyIncome={inputs.targetMonthlyIncome}
        dividendYield={inputs.dividendYield}
        retirementAge={inputs.retirementAge}
        statePensionAge={inputs.statePensionAge}
      />
      {config.locale === "uk" && (
        <LumpSumCard
          result={result}
          enabled={inputs.takeLumpSum !== false}
          retirementAge={inputs.retirementAge}
          accessAge={config.retirement.accessAge}
        />
      )}
      <NetWorthCard result={result} retirementAge={inputs.retirementAge} />
      <ProjectionChart
        data={result.projection}
        retirementAge={inputs.retirementAge}
        statePensionAge={inputs.statePensionAge}
      />
      <ScenariosTable
        result={result}
        retirementAge={inputs.retirementAge}
        currentAge={inputs.currentAge}
      />
    </div>
  );
}

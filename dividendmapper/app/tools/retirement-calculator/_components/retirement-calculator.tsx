"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import {
  calculateRetirement,
  type RetirementInputs,
  type RetirementResult,
} from "@/lib/calculators/retirement";
import { formatCurrency } from "@/lib/locale/format";
import { InputsPanel } from "./inputs-panel";
import { FireCard } from "./fire-card";
import { LumpSumCard } from "./lump-sum-card";
import { IncomeBreakdownChart } from "./income-breakdown-chart";
import { LeversCard } from "./levers-card";
import { NetWorthCard } from "./net-worth-card";
import { ProjectionChart } from "./projection-chart";
import { ScenariosTable } from "./scenarios-table";
import { SaveInputsCard } from "@/components/auth/save-inputs-card";

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
  monthlyContribution: 200, // brokerage / taxable, on top of 401(k) + IRA
  annualReturn: 0.07,
  dividendYield: 0.04,
  reinvestDividends: true,
  targetMonthlyIncome: 5000,
  statePensionAge: 67, // FRA for those born 1960+
  monthlyK401: 2042, // $24,500 / 12 — 2026 §402(g) limit
  annualIRA: 7500, // 2026 IRA limit (Notice 2025-67)
  includeSocialSecurity: true,
  socialSecurityMonthly: 2071, // 2026 average retired-worker benefit
  propertyGrowthRate: 0.03, // US long-run nominal ≈ 3%
};

// `showSaveCard` is false when embedded in the signed-in app shell
// (/app/tools/*), where the "save your inputs and sign in" prompt is redundant.
// Public marketing pages keep the default (true).
export function RetirementCalculator({
  showSaveCard = true,
}: {
  showSaveCard?: boolean;
} = {}) {
  const { config } = useLocale();
  const [inputs, setInputs] = React.useState<RetirementInputs>(UK_DEFAULTS);

  // When the locale flips, swap to that locale's default target income +
  // benefit fields. Also reset monthlyContribution because its semantics
  // change across locales: in UK it's the total split into ISA/SIPP/GIA, in
  // US it's just the taxable brokerage bucket alongside the explicit
  // 401(k) / IRA inputs.
  const lastLocaleRef = React.useRef(config.locale);
  React.useEffect(() => {
    if (lastLocaleRef.current === config.locale) return;
    const defaults = config.locale === "uk" ? UK_DEFAULTS : US_DEFAULTS;
    setInputs((prev) => ({
      ...prev,
      monthlyContribution: defaults.monthlyContribution,
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

  const handleReset = React.useCallback(() => {
    setInputs(config.locale === "uk" ? UK_DEFAULTS : US_DEFAULTS);
  }, [config.locale]);

  const handleRehydrate = React.useCallback((restored: RetirementInputs) => {
    setInputs(restored);
  }, []);

  return (
    <div className="space-y-6">
      <MobileLiveSummary result={result} retirementAge={inputs.retirementAge} />
      <InputsPanel inputs={inputs} setInputs={setInputs} onReset={handleReset} />
      {showSaveCard && (
        <SaveInputsCard
          tool="retirement"
          inputs={inputs}
          onRehydrate={handleRehydrate}
          currentPath="/tools/retirement-calculator"
        />
      )}
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
      <IncomeBreakdownChart
        result={result}
        dividendYield={inputs.dividendYield}
        retirementAge={inputs.retirementAge}
        statePensionAge={inputs.statePensionAge}
      />
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
      <LeversCard inputs={inputs} result={result} />
    </div>
  );
}

/**
 * Mobile-only sticky bar showing the live FIRE number + Base monthly income.
 * Pins below the site header (h-16) so the headline figures stay visible while
 * the user adjusts sliders and the page scrolls. Hidden on md+ where the FIRE
 * card sits comfortably alongside the inputs.
 */
function MobileLiveSummary({
  result,
  retirementAge,
}: {
  result: RetirementResult;
  retirementAge: number;
}) {
  const { config } = useLocale();
  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur md:hidden">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            FIRE number
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(result.fireNumber, config, true)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Base · age {retirementAge}
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(result.scenarios.base.monthlyDividendIncome, config)}
            /mo
          </p>
        </div>
      </div>
    </div>
  );
}

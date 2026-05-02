"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import { SliderField } from "@/components/ui/slider-field";
import { NumberField } from "@/components/ui/number-field";
import { ToggleField } from "@/components/ui/toggle-field";
import { formatCurrency } from "@/lib/locale/format";
import type { RetirementInputs } from "@/lib/calculators/retirement";

interface InputsPanelProps {
  inputs: RetirementInputs;
  setInputs: React.Dispatch<React.SetStateAction<RetirementInputs>>;
}

export function InputsPanel({ inputs, setInputs }: InputsPanelProps) {
  const { config } = useLocale();
  const symbol = config.currencySymbol;

  function patch(p: Partial<RetirementInputs>) {
    setInputs((prev) => ({ ...prev, ...p }));
  }

  // Keep retirement age above current age
  function setCurrentAge(v: number) {
    setInputs((prev) => ({
      ...prev,
      currentAge: v,
      retirementAge: Math.max(v + 1, prev.retirementAge),
    }));
  }

  // Auto-cap ISA + SIPP <= 100%
  function setIsa(v: number) {
    setInputs((prev) => ({
      ...prev,
      isaAllocation: v / 100,
      sippAllocation: Math.min(prev.sippAllocation ?? 0, (100 - v) / 100),
    }));
  }
  function setSipp(v: number) {
    setInputs((prev) => ({
      ...prev,
      sippAllocation: v / 100,
      isaAllocation: Math.min(prev.isaAllocation ?? 0, (100 - v) / 100),
    }));
  }

  return (
    <section
      aria-label="Retirement calculator inputs"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Your numbers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust the inputs — every output below recalculates instantly.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {config.locale === "uk" ? "🇬🇧 UK mode" : "🇺🇸 US mode"}
        </span>
      </header>

      {/* Shared inputs */}
      <div className="grid gap-5 md:grid-cols-2">
        <SliderField
          id="current-age"
          label="Current age"
          value={inputs.currentAge}
          onChange={setCurrentAge}
          min={18}
          max={70}
          displayValue={inputs.currentAge}
        />
        <SliderField
          id="retirement-age"
          label="Target retirement age"
          value={inputs.retirementAge}
          onChange={(v) => patch({ retirementAge: v })}
          min={inputs.currentAge + 1}
          max={80}
          displayValue={inputs.retirementAge}
          helpText={
            config.locale === "uk"
              ? `SIPP access from age ${config.retirement.accessAge}`
              : `401(k) / IRA access from age ${config.retirement.accessAge}`
          }
        />

        <NumberField
          id="current-portfolio"
          label="Current portfolio value"
          value={inputs.currentPortfolio}
          onChange={(v) => patch({ currentPortfolio: v })}
          min={0}
          prefix={symbol}
          placeholder="0"
        />
        <NumberField
          id="monthly-contribution"
          label="Monthly contribution"
          value={inputs.monthlyContribution}
          onChange={(v) => patch({ monthlyContribution: v })}
          min={0}
          prefix={symbol}
        />

        <SliderField
          id="annual-return"
          label="Expected annual return"
          value={Math.round(inputs.annualReturn * 1000) / 10}
          onChange={(v) => patch({ annualReturn: v / 100 })}
          min={1}
          max={20}
          step={0.5}
          displayValue={`${(inputs.annualReturn * 100).toFixed(1)}%`}
          helpText="FTSE All-World ≈ 8% p.a. over 30 years (nominal)."
        />
        <SliderField
          id="dividend-yield"
          label="Dividend yield at retirement"
          value={Math.round(inputs.dividendYield * 1000) / 10}
          onChange={(v) => patch({ dividendYield: v / 100 })}
          min={0.5}
          max={15}
          step={0.5}
          displayValue={`${(inputs.dividendYield * 100).toFixed(1)}%`}
          helpText="Typical dividend-focused portfolio: 3–5%."
        />

        <NumberField
          id="target-monthly-income"
          label="Target monthly income in retirement"
          value={inputs.targetMonthlyIncome}
          onChange={(v) => patch({ targetMonthlyIncome: v })}
          min={0}
          prefix={symbol}
          helpText={`Today's ${config.currencyCode} — ignore inflation, assume returns are real if you prefer.`}
        />
        <ToggleField
          id="reinvest"
          label="Reinvest dividends until retirement"
          checked={inputs.reinvestDividends}
          onChange={(v) => patch({ reinvestDividends: v })}
          helpText="Off = dividends taken as income from day 1; on = compounded into the portfolio."
        />
      </div>

      {/* UK-specific inputs */}
      {config.locale === "uk" && (
        <UkExtras inputs={inputs} setIsa={setIsa} setSipp={setSipp} patch={patch} />
      )}

      {/* US-specific inputs — placeholder until Day 6 */}
      {config.locale === "us" && (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">
            US-mode inputs ship Day 6 of the sprint.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The shared inputs above already calculate against {formatCurrency(
              inputs.targetMonthlyIncome,
              config
            )}{" "}
            in {config.currencyCode}. 401(k) / IRA / Social Security panels land
            tomorrow.
          </p>
        </div>
      )}
    </section>
  );
}

function UkExtras({
  inputs,
  setIsa,
  setSipp,
  patch,
}: {
  inputs: RetirementInputs;
  setIsa: (v: number) => void;
  setSipp: (v: number) => void;
  patch: (p: Partial<RetirementInputs>) => void;
}) {
  const isaPct = Math.round((inputs.isaAllocation ?? 0) * 100);
  const sippPct = Math.round((inputs.sippAllocation ?? 0) * 100);
  const giaPct = Math.max(0, 100 - isaPct - sippPct);

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="font-display text-base font-semibold text-foreground">
        UK tax wrappers
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Allocate your monthly contributions across ISA, SIPP, and any leftover
        General Investment Account (GIA).
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <SliderField
          id="isa-allocation"
          label="ISA allocation"
          value={isaPct}
          onChange={setIsa}
          min={0}
          max={100}
          displayValue={`${isaPct}%`}
          helpText="Tax-free growth and tax-free dividend income. £20,000/yr cap."
        />
        <SliderField
          id="sipp-allocation"
          label="SIPP allocation"
          value={sippPct}
          onChange={setSipp}
          min={0}
          max={100}
          displayValue={`${sippPct}%`}
          helpText="£60,000/yr cap. Income-tax relief in, taxable on drawdown."
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Remaining{" "}
        <span className="font-mono font-medium text-foreground">{giaPct}%</span>{" "}
        flows to a General Investment Account (GIA). Dividend allowance £500/yr.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ToggleField
          id="include-state-pension"
          label="Include State Pension"
          checked={inputs.includeStatePension ?? true}
          onChange={(v) => patch({ includeStatePension: v })}
          helpText="State Pension reduces the dividend income your portfolio needs to deliver."
        />
        <NumberField
          id="state-pension-weekly"
          label="State Pension (£/week)"
          value={inputs.statePensionWeekly ?? 221.2}
          onChange={(v) => patch({ statePensionWeekly: v })}
          min={0}
          prefix="£"
          helpText="Default = full new State Pension. Check your forecast at gov.uk."
        />
      </div>
    </div>
  );
}

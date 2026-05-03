"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import { SliderField } from "@/components/ui/slider-field";
import { NumberField } from "@/components/ui/number-field";
import { ToggleField } from "@/components/ui/toggle-field";
import type { RetirementInputs } from "@/lib/calculators/retirement";

interface InputsPanelProps {
  inputs: RetirementInputs;
  setInputs: React.Dispatch<React.SetStateAction<RetirementInputs>>;
  onReset: () => void;
}

export function InputsPanel({ inputs, setInputs, onReset }: InputsPanelProps) {
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
            Adjust the inputs and every output below recalculates instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-500 hover:text-foreground"
          >
            Reset
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {config.locale === "uk" ? "🇬🇧 UK mode" : "🇺🇸 US mode"}
          </span>
        </div>
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
          label={
            config.locale === "us"
              ? "Brokerage contribution (monthly)"
              : "Monthly contribution"
          }
          value={inputs.monthlyContribution}
          onChange={(v) => patch({ monthlyContribution: v })}
          min={0}
          prefix={symbol}
          helpText={
            config.locale === "us"
              ? "Taxable brokerage savings only — 401(k) and IRA are separate fields below."
              : undefined
          }
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
          helpText={`Enter in today's ${config.currencyCode}. The calculator works in real terms — your expected return assumption should already be net of inflation (so 7% nominal − 3% inflation ≈ 4% real if you'd rather think in nominal terms).`}
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
        <>
          <UkExtras inputs={inputs} setIsa={setIsa} setSipp={setSipp} patch={patch} />
          <UkLumpSum inputs={inputs} setInputs={setInputs} patch={patch} />
        </>
      )}

      {/* US-specific inputs */}
      {config.locale === "us" && <UsExtras inputs={inputs} patch={patch} />}

      <PropertyPanel inputs={inputs} patch={patch} />
    </section>
  );
}

function PropertyPanel({
  inputs,
  patch,
}: {
  inputs: RetirementInputs;
  patch: (p: Partial<RetirementInputs>) => void;
}) {
  const { config } = useLocale();
  const symbol = config.currencySymbol;
  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="font-display text-base font-semibold text-foreground">
        Property &amp; other assets
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Tracked alongside your portfolio for net worth. Main residence
        doesn&rsquo;t feed FIRE income (you have to live somewhere); buy-to-let
        rental income does.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <NumberField
          id="main-residence-equity"
          label="Main residence equity"
          value={inputs.mainResidenceEquity ?? 0}
          onChange={(v) => patch({ mainResidenceEquity: v })}
          min={0}
          prefix={symbol}
          helpText="Today's value minus outstanding mortgage."
        />
        <SliderField
          id="property-growth"
          label="Property growth (annual)"
          value={Math.round((inputs.propertyGrowthRate ?? 0.02) * 1000) / 10}
          onChange={(v) => patch({ propertyGrowthRate: v / 100 })}
          min={0}
          max={8}
          step={0.5}
          displayValue={`${((inputs.propertyGrowthRate ?? 0.02) * 100).toFixed(1)}%`}
          helpText="UK long-run average ≈ 2–3% real."
        />

        <NumberField
          id="btl-equity"
          label="Buy-to-let equity"
          value={inputs.buyToLetEquity ?? 0}
          onChange={(v) => patch({ buyToLetEquity: v })}
          min={0}
          prefix={symbol}
          helpText="Net of any mortgage outstanding on the rental property."
        />
        <NumberField
          id="btl-rent"
          label="Net monthly rental income"
          value={inputs.buyToLetMonthlyRent ?? 0}
          onChange={(v) => patch({ buyToLetMonthlyRent: v })}
          min={0}
          prefix={symbol}
          helpText="After agency fees, maintenance, void allowance — what actually lands in your account."
        />

        <NumberField
          id="other-assets"
          label="Other assets"
          value={inputs.otherAssetsValue ?? 0}
          onChange={(v) => patch({ otherAssetsValue: v })}
          min={0}
          prefix={symbol}
          helpText="Business equity, cash, collectibles. Net worth display only."
          className="md:col-span-2"
        />
      </div>
    </div>
  );
}

function UkLumpSum({
  inputs,
  setInputs,
  patch,
}: {
  inputs: RetirementInputs;
  setInputs: React.Dispatch<React.SetStateAction<RetirementInputs>>;
  patch: (p: Partial<RetirementInputs>) => void;
}) {
  const reinvestPct = Math.round((inputs.lumpSumReinvestPct ?? 1) * 100);
  const mortgagePct = Math.round((inputs.lumpSumMortgagePct ?? 0) * 100);
  const cashPct = Math.round((inputs.lumpSumCashPct ?? 0) * 100);

  // Auto-cap at 100% across the three sliders. When one rises, the other two
  // shrink proportionally so the total stays at 100.
  function setOne(target: "reinvest" | "mortgage" | "cash", nextPct: number) {
    setInputs((prev) => {
      const r = Math.round((prev.lumpSumReinvestPct ?? 1) * 100);
      const m = Math.round((prev.lumpSumMortgagePct ?? 0) * 100);
      const c = Math.round((prev.lumpSumCashPct ?? 0) * 100);
      const otherTotal =
        (target === "reinvest" ? 0 : r) +
        (target === "mortgage" ? 0 : m) +
        (target === "cash" ? 0 : c);
      const remaining = Math.max(0, 100 - nextPct);
      // Distribute `remaining` between the other two in their existing ratio.
      const next = { r, m, c };
      next[target === "reinvest" ? "r" : target === "mortgage" ? "m" : "c"] =
        nextPct;
      const otherKeys: ("r" | "m" | "c")[] = (
        ["r", "m", "c"] as const
      ).filter((k) => k !== (target === "reinvest" ? "r" : target === "mortgage" ? "m" : "c"));
      if (otherTotal === 0) {
        // Nothing in the other two — split the remainder evenly.
        const half = remaining / 2;
        next[otherKeys[0]] = half;
        next[otherKeys[1]] = remaining - half;
      } else {
        next[otherKeys[0]] = (next[otherKeys[0]] / otherTotal) * remaining;
        next[otherKeys[1]] = (next[otherKeys[1]] / otherTotal) * remaining;
      }
      return {
        ...prev,
        lumpSumReinvestPct: next.r / 100,
        lumpSumMortgagePct: next.m / 100,
        lumpSumCashPct: next.c / 100,
      };
    });
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="font-display text-base font-semibold text-foreground">
        25% tax-free lump sum
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        At retirement, take up to 25% of your SIPP tax-free (Pension Commencement
        Lump Sum). Capped at the £268,275 Lump Sum Allowance.
      </p>

      <div className="mt-5">
        <ToggleField
          id="take-lump-sum"
          label="Take the 25% tax-free lump sum"
          checked={inputs.takeLumpSum ?? true}
          onChange={(v) => patch({ takeLumpSum: v })}
          helpText="Off = leave the SIPP fully invested; income is calculated on the whole pot."
        />
      </div>

      {inputs.takeLumpSum !== false && (
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <SliderField
            id="lump-sum-reinvest"
            label="Reinvest in GIA"
            value={reinvestPct}
            onChange={(v) => setOne("reinvest", v)}
            min={0}
            max={100}
            displayValue={`${Math.round(reinvestPct)}%`}
            helpText="Stays earning at your dividend yield, in a taxable wrapper."
          />
          <SliderField
            id="lump-sum-mortgage"
            label="Pay mortgage / debt"
            value={mortgagePct}
            onChange={(v) => setOne("mortgage", v)}
            min={0}
            max={100}
            displayValue={`${Math.round(mortgagePct)}%`}
            helpText="Removed from portfolio. Adjust your target income to reflect lower outgoings."
          />
          <SliderField
            id="lump-sum-cash"
            label="Cash for spending"
            value={cashPct}
            onChange={(v) => setOne("cash", v)}
            min={0}
            max={100}
            displayValue={`${Math.round(cashPct)}%`}
            helpText="One-off withdrawal — holiday, gift, peace of mind."
          />
        </div>
      )}
    </div>
  );
}

function UsExtras({
  inputs,
  patch,
}: {
  inputs: RetirementInputs;
  patch: (p: Partial<RetirementInputs>) => void;
}) {
  // 2026 IRS limits — IRS Notice 2025-67. Source of truth:
  //   planning/research/us-retirement-rules.md
  const K401_LIMIT_ANNUAL = 24500;
  const IRA_LIMIT_ANNUAL = 7500;
  // Monthly entries naturally round up (24,500 / 12 = 2,041.67, users type 2,042),
  // so we allow up to one month of slack before flagging as over-limit.
  const k401Annual = (inputs.monthlyK401 ?? 0) * 12;
  const overK401 = k401Annual > K401_LIMIT_ANNUAL + (K401_LIMIT_ANNUAL / 12);
  const overIra = (inputs.annualIRA ?? 0) > IRA_LIMIT_ANNUAL;

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="font-display text-base font-semibold text-foreground">
        US tax wrappers
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        401(k) and IRA contributions are tracked separately so we can flag the
        2026 limits and split your dividend income across tax-advantaged and
        taxable accounts.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <NumberField
          id="monthly-401k"
          label="401(k) contribution (monthly)"
          value={inputs.monthlyK401 ?? 0}
          onChange={(v) => patch({ monthlyK401: v })}
          min={0}
          prefix="$"
          helpText={
            overK401
              ? `Above the 2026 §402(g) limit of $24,500/yr ($2,042/mo). Catch-up contributions kick in at 50+.`
              : "2026 employee deferral limit: $24,500/yr ($2,042/mo). Catch-up at 50+."
          }
        />
        <NumberField
          id="annual-ira"
          label="IRA / Roth IRA contribution (annual)"
          value={inputs.annualIRA ?? 0}
          onChange={(v) => patch({ annualIRA: v })}
          min={0}
          prefix="$"
          helpText={
            overIra
              ? "Above the 2026 IRA limit of $7,500. Catch-up adds $1,100 at age 50+."
              : "2026 limit: $7,500 (Trad + Roth combined). Catch-up adds $1,100 at 50+."
          }
        />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ToggleField
          id="include-social-security"
          label="Include Social Security"
          checked={inputs.includeSocialSecurity ?? true}
          onChange={(v) => patch({ includeSocialSecurity: v })}
          helpText="Social Security supplements your portfolio income from your claim age onwards."
        />
        <NumberField
          id="social-security-monthly"
          label="Social Security ($/month)"
          value={inputs.socialSecurityMonthly ?? 2071}
          onChange={(v) => patch({ socialSecurityMonthly: v })}
          min={0}
          prefix="$"
          helpText="2026 average retired-worker benefit ≈ $2,071. Find your estimate at ssa.gov/myaccount."
        />
        <SliderField
          id="ss-claim-age"
          label="Social Security claim age"
          value={inputs.statePensionAge}
          onChange={(v) => patch({ statePensionAge: v })}
          min={62}
          max={70}
          displayValue={inputs.statePensionAge}
          helpText="Claim 62 → 70. FRA = 67 (born 1960+). Each year delayed past FRA adds ~8% (Delayed Retirement Credits)."
        />
      </div>
    </div>
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
          helpText="State Pension supplements your portfolio income from age 67 onwards."
        />
        <NumberField
          id="state-pension-weekly"
          label="State Pension (£/week)"
          value={inputs.statePensionWeekly ?? 241.3}
          onChange={(v) => patch({ statePensionWeekly: v })}
          min={0}
          prefix="£"
          helpText="2026/27 full new State Pension is £241.30. Check your forecast at gov.uk."
        />
        <SliderField
          id="state-pension-age"
          label="State Pension age"
          value={inputs.statePensionAge}
          onChange={(v) => patch({ statePensionAge: v })}
          min={60}
          max={75}
          displayValue={inputs.statePensionAge}
          helpText="Currently rising 66 → 67 through 2026/27; legislated to rise to 68 from 2044."
        />
      </div>
    </div>
  );
}

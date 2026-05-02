"use client";

import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import type { RetirementResult } from "@/lib/calculators/retirement";

interface FireCardProps {
  result: RetirementResult;
  currentPortfolio: number;
  targetMonthlyIncome: number;
  dividendYield: number;
  retirementAge: number;
  statePensionAge: number;
}

export function FireCard({
  result,
  currentPortfolio,
  targetMonthlyIncome,
  dividendYield,
  retirementAge,
  statePensionAge,
}: FireCardProps) {
  const { config } = useLocale();
  const progress =
    result.fireNumber > 0
      ? Math.min(100, (currentPortfolio / result.fireNumber) * 100)
      : 100;

  return (
    <section
      aria-label="FIRE number"
      className="rounded-xl border border-border bg-card p-6"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Your FIRE number
      </p>
      <p className="mt-3 font-mono text-4xl font-semibold tabular-nums text-foreground md:text-5xl">
        {formatCurrency(result.fireNumber, config, true)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Portfolio needed at age{" "}
        <span className="font-medium text-foreground">{retirementAge}</span> to
        throw off{" "}
        <span className="font-medium text-foreground">
          {formatCurrency(result.portfolioTargetMonthly, config)}/mo
        </span>{" "}
        at{" "}
        <span className="font-medium text-foreground">
          {(dividendYield * 100).toFixed(1)}%
        </span>{" "}
        yield — your full target until {config.retirement.stateLabel} starts.
      </p>

      <div className="mt-6">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>You&rsquo;re at</span>
          <span className="font-mono tabular-nums">
            {formatCurrency(currentPortfolio, config, true)} ({progress.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {(result.benefitMonthly > 0 || result.property.rentalMonthly > 0) && (
        <TwoPhasePanel
          targetMonthly={targetMonthlyIncome}
          benefitMonthly={result.benefitMonthly}
          rentalMonthly={result.property.rentalMonthly}
          portfolioTargetMonthly={result.portfolioTargetMonthly}
          portfolioTargetAfterBenefit={result.portfolioTargetAfterBenefit}
          retirementAge={retirementAge}
          statePensionAge={statePensionAge}
          hasBridgePhase={result.hasBridgePhase}
          bridgeYears={result.bridgeYears}
          stateLabel={config.retirement.stateLabel}
        />
      )}
    </section>
  );
}

interface TwoPhasePanelProps {
  targetMonthly: number;
  benefitMonthly: number;
  rentalMonthly: number;
  portfolioTargetMonthly: number;
  portfolioTargetAfterBenefit: number;
  retirementAge: number;
  statePensionAge: number;
  hasBridgePhase: boolean;
  bridgeYears: number;
  stateLabel: string;
}

function TwoPhasePanel({
  targetMonthly,
  benefitMonthly,
  rentalMonthly,
  portfolioTargetMonthly,
  portfolioTargetAfterBenefit,
  retirementAge,
  statePensionAge,
  hasBridgePhase,
  bridgeYears,
  stateLabel,
}: TwoPhasePanelProps) {
  const { config } = useLocale();
  const _unused = targetMonthly; // kept for parity with prior signature

  if (!hasBridgePhase) {
    // Retiring at or after SPA — no bridge gap to explain.
    return (
      <div className="mt-6 rounded-lg border border-border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Income at retirement
        </p>
        <p className="mt-2 text-sm text-foreground">
          {stateLabel}
          {rentalMonthly > 0 ? " and rental income" : ""} {rentalMonthly > 0 ? "are" : "is"} already paying — your portfolio only
          needs to cover{" "}
          <span className="font-mono font-medium">
            {formatCurrency(portfolioTargetAfterBenefit, config)}/mo
          </span>
          .
        </p>
      </div>
    );
  }

  const phase1Rows = [
    {
      label: "From portfolio dividends",
      amount: portfolioTargetMonthly,
      emphasis: true,
    },
    rentalMonthly > 0 && { label: "From rental income", amount: rentalMonthly },
    { label: `From ${stateLabel}`, amount: 0, mute: true },
  ].filter(Boolean) as PhaseRow[];

  const phase2Rows = [
    { label: "From portfolio dividends", amount: portfolioTargetAfterBenefit },
    rentalMonthly > 0 && { label: "From rental income", amount: rentalMonthly },
    { label: `From ${stateLabel}`, amount: benefitMonthly, emphasis: true },
  ].filter(Boolean) as PhaseRow[];

  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <PhaseCard
        phase="Phase 1 · bridge years"
        ageRange={`Age ${retirementAge} → ${statePensionAge}`}
        years={`${bridgeYears} year${bridgeYears === 1 ? "" : "s"}`}
        rows={phase1Rows}
        accent="bridge"
      />
      <PhaseCard
        phase={`Phase 2 · ${stateLabel} on`}
        ageRange={`Age ${statePensionAge}+`}
        years="for life"
        rows={phase2Rows}
        accent="benefit"
      />
    </div>
  );
}

interface PhaseRow {
  label: string;
  amount: number;
  emphasis?: boolean;
  mute?: boolean;
}

interface PhaseCardProps {
  phase: string;
  ageRange: string;
  years: string;
  rows: PhaseRow[];
  accent: "bridge" | "benefit";
}

function PhaseCard({ phase, ageRange, years, rows, accent }: PhaseCardProps) {
  const { config } = useLocale();
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {phase}
        </p>
        <span
          className={
            accent === "bridge"
              ? "rounded-full bg-income-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-income-900 dark:bg-income-900/40 dark:text-income-100"
              : "rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
          }
        >
          {years}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{ageRange}</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <li
            key={r.label}
            className={`flex items-baseline justify-between ${r.mute ? "text-muted-foreground" : "text-foreground"}`}
          >
            <span>{r.label}</span>
            <span
              className={`font-mono tabular-nums ${r.emphasis ? "font-semibold" : ""}`}
            >
              {formatCurrency(r.amount, config)}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between border-t border-border pt-1.5 text-sm font-medium text-foreground">
          <span>Total monthly</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatCurrency(total, config)}
          </span>
        </li>
      </ul>
    </div>
  );
}

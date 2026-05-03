"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import { cn } from "@/lib/utils";
import type { RetirementResult } from "@/lib/calculators/retirement";

interface IncomeBreakdownChartProps {
  result: RetirementResult;
  /** Annual yield used to translate wrapper values into monthly dividend income. */
  dividendYield: number;
  retirementAge: number;
  statePensionAge: number;
}

interface IncomeRow {
  /** Stable key for React + tooltip lookups. */
  key: string;
  label: string;
  /** Monthly figure (this phase). */
  amount: number;
  /** Color slot — matches CSS variables already used in the projection chart. */
  swatch: string;
  /** Optional badge / tax note shown beside the row. */
  note?: string;
  /** Tone for the note tile. */
  tone?: "ok" | "warn";
}

type Phase = "phase1" | "phase2";

/**
 * Stacked monthly-income breakdown at retirement, Base scenario.
 *
 * Renders dividend income per wrapper plus the state benefit and any rental
 * income. If the user retires before the state benefit kicks in (bridge years),
 * a tab lets them inspect Phase 1 (no benefit yet) vs Phase 2 (benefit on).
 */
export function IncomeBreakdownChart({
  result,
  dividendYield,
  retirementAge,
  statePensionAge,
}: IncomeBreakdownChartProps) {
  const { config } = useLocale();
  const [phase, setPhase] = React.useState<Phase>("phase2");

  // Same yield assumption as the projection chart — wrapper-specific yields
  // are a Phase 2 refinement.
  const monthlyYield = Math.max(0, dividendYield) / 12;
  const base = result.scenarios.base;

  // Lump-sum mortgage/cash withdrawals reduce the wrapper that funds the
  // dividend stream. The calc layer already accounts for this on the SIPP.
  // We approximate per-wrapper income as wrapper_value × monthlyYield, with
  // the SIPP value reduced proportionally to reflect the lump sum that left
  // the portfolio (mortgage + cash). This is consistent with the FIRE math
  // and the scenario table.
  const sippAfterLumpSum = Math.max(
    0,
    base.wrappers.sipp - base.lumpSum.toMortgage - base.lumpSum.toCash
  );

  const wrapperIncome = {
    isa: base.wrappers.isa * monthlyYield,
    sipp: sippAfterLumpSum * monthlyYield,
    gia: base.wrappers.gia * monthlyYield,
  };

  const rental = result.property.rentalMonthly;
  const benefit = phase === "phase2" ? result.benefitMonthly : 0;

  const labels = locales[config.locale];
  const annualGiaIncome = wrapperIncome.gia * 12;
  const dividendAllowance = config.dividendTax.allowance;
  const giaOverAllowance =
    config.locale === "uk" && dividendAllowance > 0 && annualGiaIncome > dividendAllowance
      ? annualGiaIncome - dividendAllowance
      : 0;

  const rows: IncomeRow[] = [
    {
      key: "isa",
      label: labels.isaLabel,
      amount: wrapperIncome.isa,
      swatch: "var(--color-brand-500)",
      note: labels.isaNote,
      tone: "ok",
    },
    {
      key: "sipp",
      label: labels.sippLabel,
      amount: wrapperIncome.sipp,
      swatch: "var(--color-chart-2)",
      note: labels.sippNote,
    },
    {
      key: "gia",
      label: labels.giaLabel,
      amount: wrapperIncome.gia,
      swatch: "var(--color-chart-4)",
      note:
        giaOverAllowance > 0
          ? `${formatCurrency(giaOverAllowance, config)}/yr above the ${formatCurrency(dividendAllowance, config)} dividend allowance — taxable.`
          : labels.giaNote,
      tone: giaOverAllowance > 0 ? "warn" : undefined,
    },
    rental > 0 && {
      key: "rental",
      label: "Rental income",
      amount: rental,
      swatch: "var(--color-income-500)",
      note: "Net of agency, maintenance, void allowance.",
    },
    benefit > 0 && {
      key: "benefit",
      label: config.retirement.stateLabel,
      amount: benefit,
      swatch: "var(--color-income-700)",
      note: labels.benefitNote,
      tone: "ok",
    },
  ].filter(Boolean) as IncomeRow[];

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const hasIncome = total > 0;
  // User's input target = what the portfolio still owes after rental + state
  // benefit, plus the rental and benefit themselves. Stable across phases.
  const userTarget =
    result.portfolioTargetAfterBenefit + result.benefitMonthly + rental;

  return (
    <section
      aria-label="Monthly income breakdown at retirement"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Income breakdown
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Where your monthly income comes from at age {retirementAge}, Base
            scenario.
          </p>
        </div>

        {result.hasBridgePhase && (
          <PhaseTabs
            value={phase}
            onChange={setPhase}
            retirementAge={retirementAge}
            statePensionAge={statePensionAge}
            stateLabel={config.retirement.stateLabel}
          />
        )}
      </header>

      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total monthly
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground md:text-4xl">
            {formatCurrency(total, config)}
          </p>
        </div>

        {hasIncome ? (
          <StackedBar rows={rows} total={total} />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No projected income yet — increase contributions, reduce target age,
            or raise the dividend yield to see the breakdown.
          </p>
        )}

        {hasIncome && (
          <p className="mt-3 text-xs text-muted-foreground">
            vs your{" "}
            <span className="font-mono">
              {formatCurrency(userTarget, config)}
            </span>{" "}
            target:{" "}
            <span
              className={cn(
                "font-mono font-medium",
                total >= userTarget ? "text-positive" : "text-negative"
              )}
            >
              {total >= userTarget ? "+" : "−"}
              {formatCurrency(Math.abs(total - userTarget), config)}
            </span>
            .
          </p>
        )}
      </div>

      {hasIncome && (
        <ul className="mt-5 divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full"
                  style={{ backgroundColor: r.swatch }}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {r.label}
                  </p>
                  {r.note && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        r.tone === "warn"
                          ? "text-negative"
                          : r.tone === "ok"
                            ? "text-positive"
                            : "text-muted-foreground"
                      )}
                    >
                      {r.note}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(r.amount, config)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Tax notes are informational. This is not financial or tax advice.
      </p>
    </section>
  );
}

function StackedBar({ rows, total }: { rows: IncomeRow[]; total: number }) {
  const { config } = useLocale();
  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label="Stacked monthly income bar"
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        {rows.map((r) => {
          const pct = total > 0 ? (r.amount / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <span
              key={r.key}
              title={`${r.label}: ${formatCurrency(r.amount, config)}/mo`}
              className="h-full"
              style={{
                width: `${pct}%`,
                backgroundColor: r.swatch,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PhaseTabs({
  value,
  onChange,
  retirementAge,
  statePensionAge,
  stateLabel,
}: {
  value: Phase;
  onChange: (p: Phase) => void;
  retirementAge: number;
  statePensionAge: number;
  stateLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Income phase"
      className="flex rounded-full border border-border bg-background p-0.5 text-xs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "phase1"}
        onClick={() => onChange("phase1")}
        className={cn(
          "rounded-full px-2.5 py-1 font-medium transition-colors",
          value === "phase1"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Bridge · {retirementAge}–{statePensionAge}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "phase2"}
        onClick={() => onChange("phase2")}
        className={cn(
          "rounded-full px-2.5 py-1 font-medium transition-colors",
          value === "phase2"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {stateLabel} on · {statePensionAge}+
      </button>
    </div>
  );
}

interface LocaleLabels {
  isaLabel: string;
  sippLabel: string;
  giaLabel: string;
  isaNote: string;
  sippNote: string;
  giaNote: string;
  benefitNote: string;
}

const locales: Record<"uk" | "us", LocaleLabels> = {
  uk: {
    isaLabel: "ISA dividends",
    sippLabel: "SIPP dividends",
    giaLabel: "GIA dividends",
    isaNote: "Tax-free — no income tax on dividends or growth.",
    sippNote: "Drawdown counts as income. 25% tax-free lump sum already applied.",
    giaNote: "First £500/yr covered by the dividend allowance.",
    benefitNote: "2026/27 full new State Pension is £241.30/wk — taxable income.",
  },
  us: {
    isaLabel: "IRA / Roth IRA dividends",
    sippLabel: "401(k) dividends",
    giaLabel: "Brokerage dividends",
    isaNote: "Roth = tax-free withdrawals. Trad IRA = taxable on withdrawal.",
    sippNote: "Withdrawals taxed as ordinary income. RMDs from 73 (75 if born 1960+).",
    giaNote: "Qualified dividends taxed at 0% / 15% / 20% — see your bracket.",
    benefitNote: "FRA 67 → 124% of PIA at 70 (Delayed Retirement Credits).",
  },
};

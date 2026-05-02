"use client";

import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import type { RetirementResult, ScenarioResult } from "@/lib/calculators/retirement";
import { cn } from "@/lib/utils";

interface ScenariosTableProps {
  result: RetirementResult;
  retirementAge: number;
  currentAge: number;
}

export function ScenariosTable({
  result,
  retirementAge,
  currentAge,
}: ScenariosTableProps) {
  const { config } = useLocale();
  const cols = [
    { key: "bear" as const, label: "Bear", scenario: result.scenarios.bear },
    { key: "base" as const, label: "Base", scenario: result.scenarios.base },
    { key: "bull" as const, label: "Bull", scenario: result.scenarios.bull },
    { key: "weighted" as const, label: "Weighted avg", scenario: result.weighted },
  ];

  return (
    <section
      aria-label="Scenario summary table"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="border-b border-border px-4 py-4 md:px-6">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Scenario summary
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          What each scenario looks like at retirement.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium md:px-6">
                Metric
                <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                  At age {retirementAge}
                </span>
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-right font-medium md:px-6",
                    c.key === "base" && "text-brand-700 dark:text-brand-400",
                    c.key === "weighted" && "text-foreground"
                  )}
                >
                  {c.label}
                  <span
                    className={cn(
                      "mt-0.5 block text-[10px] font-normal normal-case tracking-normal",
                      c.key === "base"
                        ? "text-brand-700/70 dark:text-brand-400/70"
                        : "text-muted-foreground"
                    )}
                  >
                    Age {retirementAge}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row
              label="Portfolio at retirement"
              cols={cols}
              format={(s) => formatCurrency(s.portfolioAtRetirement, config, true)}
            />
            <Row
              label="Annual dividend income"
              cols={cols}
              format={(s) => formatCurrency(s.annualDividendIncome, config, true)}
            />
            <Row
              label="Monthly dividend income"
              cols={cols}
              format={(s) => formatCurrency(s.monthlyDividendIncome, config)}
            />
            <Row
              label="vs your target"
              cols={cols}
              format={(s) => {
                const sign = s.vsTarget >= 0 ? "+" : "−";
                return `${sign}${formatCurrency(Math.abs(s.vsTarget), config)}`;
              }}
              valueClass={(s) =>
                s.vsTarget >= 0 ? "text-positive" : "text-negative"
              }
            />
            <Row
              label="Years to FIRE number"
              cols={cols}
              format={(s) => {
                if (s.yearsToFire === null) return "—";
                const ageAtFire = currentAge + s.yearsToFire;
                return `${s.yearsToFire.toFixed(1)} yrs · age ${ageAtFire.toFixed(0)}`;
              }}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({
  label,
  cols,
  format,
  valueClass,
}: {
  label: string;
  cols: { key: string; scenario: ScenarioResult }[];
  format: (s: ScenarioResult) => string;
  valueClass?: (s: ScenarioResult) => string;
}) {
  return (
    <tr className="text-sm">
      <th
        scope="row"
        className="px-4 py-3 text-left font-medium text-foreground md:px-6"
      >
        {label}
      </th>
      {cols.map((c) => (
        <td
          key={c.key}
          className={cn(
            "px-4 py-3 text-right font-mono tabular-nums text-foreground md:px-6",
            valueClass?.(c.scenario)
          )}
        >
          {format(c.scenario)}
        </td>
      ))}
    </tr>
  );
}

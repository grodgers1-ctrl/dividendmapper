"use client";

import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import type { RetirementResult } from "@/lib/calculators/retirement";

interface NetWorthCardProps {
  result: RetirementResult;
  retirementAge: number;
}

/**
 * Shows total net worth at retirement = dividend portfolio + property + other.
 * Renders nothing if the user hasn't entered any property/other assets.
 */
export function NetWorthCard({ result, retirementAge }: NetWorthCardProps) {
  const { config } = useLocale();
  const property = result.property;
  const portfolioBase = result.scenarios.base.portfolioAtRetirement;
  const total = portfolioBase + property.totalAtRetirement;

  if (property.totalAtRetirement === 0 && property.rentalMonthly === 0) {
    return null;
  }

  const rows = [
    { label: "Dividend portfolio (Base)", amount: portfolioBase, accent: "brand" as const },
    property.mainResidenceAtRetirement > 0 && {
      label: "Main residence equity",
      amount: property.mainResidenceAtRetirement,
      note: "Not in FIRE income — you have to live somewhere.",
    },
    property.buyToLetAtRetirement > 0 && {
      label: "Buy-to-let equity",
      amount: property.buyToLetAtRetirement,
      note: property.rentalMonthly > 0
        ? `+ ${formatCurrency(property.rentalMonthly, config)}/mo rental in income`
        : undefined,
    },
    property.otherAssets > 0 && {
      label: "Other assets",
      amount: property.otherAssets,
    },
  ].filter(Boolean) as {
    label: string;
    amount: number;
    accent?: "brand";
    note?: string;
  }[];

  return (
    <section
      aria-label="Net worth at retirement"
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total net worth at age {retirementAge}
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground md:text-4xl">
            {formatCurrency(total, config, true)}
          </p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p
                className={
                  r.accent === "brand"
                    ? "text-sm font-medium text-brand-700 dark:text-brand-400"
                    : "text-sm font-medium text-foreground"
                }
              >
                {r.label}
              </p>
              {r.note && (
                <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>
              )}
            </div>
            <span className="font-mono text-base font-medium tabular-nums text-foreground">
              {formatCurrency(r.amount, config, true)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

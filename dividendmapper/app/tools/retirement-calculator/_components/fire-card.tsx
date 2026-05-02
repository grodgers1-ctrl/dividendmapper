"use client";

import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import type { RetirementResult } from "@/lib/calculators/retirement";

interface FireCardProps {
  result: RetirementResult;
  currentPortfolio: number;
  targetMonthlyIncome: number;
  dividendYield: number;
}

export function FireCard({
  result,
  currentPortfolio,
  targetMonthlyIncome,
  dividendYield,
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
        Portfolio needed to throw off{" "}
        <span className="font-medium text-foreground">
          {formatCurrency(result.portfolioTargetMonthly, config)}/mo
        </span>{" "}
        at{" "}
        <span className="font-medium text-foreground">
          {(dividendYield * 100).toFixed(1)}%
        </span>{" "}
        yield
        {result.benefitMonthly > 0 ? (
          <>
            , after crediting{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(result.benefitMonthly, config)}/mo
            </span>{" "}
            from {config.retirement.stateLabel} towards your{" "}
            {formatCurrency(targetMonthlyIncome, config)} target.
          </>
        ) : (
          "."
        )}
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
    </section>
  );
}

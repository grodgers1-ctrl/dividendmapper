"use client";

import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import type { RetirementResult } from "@/lib/calculators/retirement";

interface LumpSumCardProps {
  result: RetirementResult;
  enabled: boolean;
  retirementAge: number;
  accessAge: number;
}

/**
 * Displays the UK 25% tax-free pension lump sum at retirement, the user's
 * allocation across reinvest / mortgage / cash, and the income impact.
 * Renders nothing for US locale (lump sum is UK-specific).
 */
export function LumpSumCard({
  result,
  enabled,
  retirementAge,
  accessAge,
}: LumpSumCardProps) {
  const { config } = useLocale();
  const base = result.scenarios.base;
  const ls = base.lumpSum;

  if (!enabled) return null;

  // Honest about the access-age constraint: lump sum can only be taken at NMPA.
  const lockedYears = Math.max(0, accessAge - retirementAge);
  const isLocked = lockedYears > 0;

  // Income hit: the difference between full-portfolio yield and post-allocation yield.
  const incomeHitMonthly =
    base.portfolioAtRetirement * config.riskFreeRate / 12 -
    base.effectivePortfolio * config.riskFreeRate / 12;
  const removed = ls.toMortgage + ls.toCash;

  return (
    <section
      aria-label="Tax-free lump sum"
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            25% tax-free lump sum (Base scenario)
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground md:text-4xl">
            {formatCurrency(ls.taken, config, true)}
          </p>
        </div>
        <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
          UK · PCLS
        </span>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        25% of your projected SIPP value at age {retirementAge}, capped at the
        Lump Sum Allowance (£268,275). Tax-free.
      </p>

      {ls.grossEligible > ls.taken + 1 && (
        <p className="mt-2 rounded-md border border-income-500/30 bg-income-50/50 px-3 py-2 text-xs text-income-900 dark:bg-income-900/10 dark:text-income-100">
          Your projected SIPP would entitle you to{" "}
          <span className="font-mono">
            {formatCurrency(ls.grossEligible, config, true)}
          </span>
          . The Lump Sum Allowance caps the tax-free amount at{" "}
          <span className="font-mono">£268,275</span>.
        </p>
      )}

      {isLocked && (
        <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          You retire at age {retirementAge} but the SIPP can&rsquo;t be accessed
          until {accessAge}. The lump sum becomes available {lockedYears}{" "}
          year{lockedYears === 1 ? "" : "s"} into retirement — bridge that gap
          from ISA / GIA.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <AllocationTile
          label="Reinvested in GIA"
          amount={ls.reinvested}
          tone="reinvest"
        />
        <AllocationTile
          label="To mortgage / debt"
          amount={ls.toMortgage}
          tone="leaves"
        />
        <AllocationTile
          label="Cash for spending"
          amount={ls.toCash}
          tone="leaves"
        />
      </div>

      {removed > 0 && (
        <div className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">
            {formatCurrency(removed, config, true)}
          </span>{" "}
          leaves the portfolio, lowering monthly dividend income by{" "}
          <span className="font-mono font-medium text-negative">
            {formatCurrency(incomeHitMonthly, config)}
          </span>
          . If clearing your mortgage drops outgoings by more than that, it&rsquo;s
          still a net win — adjust your target income manually.
        </div>
      )}
    </section>
  );
}

function AllocationTile({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "reinvest" | "leaves";
}) {
  const { config } = useLocale();
  return (
    <div
      className={
        tone === "reinvest"
          ? "rounded-lg border border-brand-500/30 bg-brand-50/50 p-3 dark:bg-brand-900/10"
          : "rounded-lg border border-border bg-background p-3"
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {formatCurrency(amount, config, true)}
      </p>
    </div>
  );
}

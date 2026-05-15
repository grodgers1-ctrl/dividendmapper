"use client";

import { useLocale } from "@/lib/locale/context";
import {
  formatShareCurrency,
  resolveCurrency,
} from "@/lib/calculators/dcf-currency";
import { InfoPopover } from "@/components/ui/info-popover";
import type { DcfInputs, DcfResult, YocPoint } from "@/lib/calculators/dcf";
import { cn } from "@/lib/utils";

interface YieldOnCostCardProps {
  inputs: DcfInputs;
  result: DcfResult;
}

/**
 * Today's yield-on-cost plus the YoC trajectory over the next decade at the
 * Base growth rate. The story dividend investors are buying: "if I lock in
 * this stock today and the dividend grows at my expected rate, my yield on
 * the price I paid in N years is X%". A 2.6% starting yield growing at 5%
 * becomes 4.2% by year 10. That's the compounding-coupon argument for
 * dividend growth investing in one card.
 */
export function YieldOnCostCard({ inputs, result }: YieldOnCostCardProps) {
  const { config } = useLocale();
  const currency = resolveCurrency(inputs.currency, config);

  // Legacy field name on DcfResult — semantically this is year-0 YoC.
  if (
    result.breakEvenYield === null ||
    result.yieldOnCostTrajectory.length === 0
  ) {
    return null;
  }

  const trajectory = result.yieldOnCostTrajectory;
  const today = trajectory[0];
  const tenYr = trajectory[trajectory.length - 1];
  const fiveYr = trajectory[5] ?? trajectory[trajectory.length - 1];

  return (
    <section
      aria-label="Yield on cost trajectory"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
            Future yield on cost
            <InfoPopover label="What's yield on cost?">
              <p>
                <strong>Yield on cost.</strong> The dividend yield measured
                against the price you actually paid, not today&rsquo;s price.
                Year 0 is the yield you lock in by buying now.
              </p>
              <p className="mt-2 text-muted-foreground">
                If the dividend grows from here, your effective yield on that
                purchase price keeps rising — that&rsquo;s the
                compounding-coupon argument for dividend growth investing.
                The trajectory below uses your Base scenario growth rate.
              </p>
            </InfoPopover>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            What today&rsquo;s price gets you, and what it could become.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <YocTile
          label="Today"
          value={today.yieldOnCost}
          subtitle={`At ${formatShareCurrency(inputs.currentPrice, currency)}`}
          emphasis
        />
        <YocTile
          label="In 5 years"
          value={fiveYr.yieldOnCost}
          subtitle={`Dividend ≈ ${formatShareCurrency(
            fiveYr.yieldOnCost * inputs.currentPrice,
            currency
          )}/share`}
        />
        <YocTile
          label={`In ${tenYr.year} years`}
          value={tenYr.yieldOnCost}
          subtitle={`Dividend ≈ ${formatShareCurrency(
            tenYr.yieldOnCost * inputs.currentPrice,
            currency
          )}/share`}
        />
      </div>

      <YocBars trajectory={trajectory} />

      <p className="mt-3 text-xs text-muted-foreground">
        Compounded at the Base scenario growth rate (
        <span className="font-mono font-medium text-foreground">
          {(result.scenarios.base.growth * 100).toFixed(1)}%
        </span>
        ). Past dividend growth doesn&rsquo;t guarantee future hikes.
      </p>
    </section>
  );
}

function YocTile({
  label,
  value,
  subtitle,
  emphasis,
}: {
  label: string;
  value: number;
  subtitle: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-4",
        emphasis && "border-brand-500/40 bg-brand-500/5"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground",
          emphasis && "text-brand-700 dark:text-brand-400"
        )}
      >
        {(value * 100).toFixed(2)}%
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function YocBars({ trajectory }: { trajectory: YocPoint[] }) {
  const max = trajectory[trajectory.length - 1].yieldOnCost;
  if (max <= 0) return null;
  return (
    <div className="mt-5">
      <div className="flex h-16 items-end gap-1">
        {trajectory.map((p) => (
          <div
            key={p.year}
            title={`Year ${p.year}: ${(p.yieldOnCost * 100).toFixed(2)}%`}
            className="flex-1 rounded-sm bg-brand-500/30 transition-colors hover:bg-brand-500/50"
            style={{ height: `${(p.yieldOnCost / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Now</span>
        <span>Year 10</span>
      </div>
    </div>
  );
}

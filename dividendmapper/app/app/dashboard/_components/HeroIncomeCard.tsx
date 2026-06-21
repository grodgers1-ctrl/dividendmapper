// Day 5 dashboard hero. Server-only. The £X,XXX figure is the same forward
// annual run-rate the Portfolio Ledger shows (sum of estimate-preferring
// PortfolioIncome.totalsByCurrency rows in GBP) — passed in by page.tsx
// so this stays pure.
//
// Brand accent #1 (contour SVG at ~4% opacity baked into the asset) sits as
// a backgroundImage with `mix-blend-overlay`, matching the drawer-footer
// treatment. The sparkline (accent #3) lives below the headline.

import { RidgeSparkline, type RidgePoint } from "./RidgeSparkline";

export interface HeroIncomeCardProps {
  incomeAnnualGbp: number;
  sparkline: ReadonlyArray<RidgePoint>;
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function HeroIncomeCard({
  incomeAnnualGbp,
  sparkline,
}: HeroIncomeCardProps) {
  const value = GBP.format(Math.round(incomeAnnualGbp));

  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]"
      style={{
        backgroundColor: "var(--surface)",
        backgroundImage: "url('/brand/contour.svg')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundBlendMode: "overlay",
      }}
    >
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Projected annual dividend income
      </p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-[var(--text)] tabular-nums sm:text-5xl">
        {value}
      </p>
      <div className="mt-4">
        <RidgeSparkline data={sparkline} height={72} />
      </div>
    </div>
  );
}

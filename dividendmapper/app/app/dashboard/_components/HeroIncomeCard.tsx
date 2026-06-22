"use client";

// Day 5 dashboard hero — augmented in the quick-wins sprint with a 3-cell
// stat strip (Monthly · Weekly · Yield on cost) tucked between the headline
// £ and the ridgeline sparkline. Animation language matches ScoreOrb +
// SignalContributionsList: smooth-out easing, sub-second fade-and-rise with
// per-cell stagger, useReducedMotion() guard.
//
// Brand accent #1 (contour SVG at ~4% opacity baked into the asset) sits as
// a backgroundImage with `mix-blend-overlay`, matching the drawer-footer
// treatment. The sparkline (accent #3) lives below the headline.

import { motion, useReducedMotion } from "framer-motion";
import { RidgeSparkline, type RidgePoint } from "./RidgeSparkline";

export interface HeroIncomeCardProps {
  incomeAnnualGbp: number;
  sparkline: ReadonlyArray<RidgePoint>;
  /** Sum of cost basis converted to GBP. Null/≤0 → YoC cell renders "—". */
  totalCostGbp?: number | null;
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const PCT_1DP = new Intl.NumberFormat("en-GB", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const STRIP_DELAY = 0.15;
const STAGGER = 0.06;

export function HeroIncomeCard({
  incomeAnnualGbp,
  sparkline,
  totalCostGbp,
}: HeroIncomeCardProps) {
  const reduce = useReducedMotion();
  const value = GBP.format(Math.round(incomeAnnualGbp));
  const monthly = GBP.format(Math.round(incomeAnnualGbp / 12));
  const weekly = GBP.format(Math.round(incomeAnnualGbp / 52));
  const yocPct =
    typeof totalCostGbp === "number" && totalCostGbp > 0
      ? PCT_1DP.format(incomeAnnualGbp / totalCostGbp)
      : null;

  const cells: { label: string; value: string; testId?: string }[] = [
    { label: "Monthly", value: monthly },
    { label: "Weekly", value: weekly },
    { label: "Yield on cost", value: yocPct ?? "—", testId: "hero-yoc" },
  ];

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

      <div className="mt-5 grid grid-cols-3 gap-6 border-t border-[var(--border-subtle)] pt-4">
        {cells.map((c, i) => (
          <motion.div
            key={c.label}
            data-testid={c.testId}
            initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduce ? 0 : 0.5,
              delay: reduce ? 0 : STRIP_DELAY + i * STAGGER,
              ease: EASE,
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {c.label}
            </p>
            <p className="mt-1 font-mono text-sm tabular-nums text-[var(--text)]">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4">
        <RidgeSparkline data={sparkline} height={72} />
      </div>
    </div>
  );
}

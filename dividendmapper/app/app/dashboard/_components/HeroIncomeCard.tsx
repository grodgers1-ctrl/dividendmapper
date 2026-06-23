"use client";

// Dashboard hero — £-headline + Monthly/Weekly/YoC stat strip. The
// decorative ridge sparkline was removed in the 23 Jun redesign; the
// time-series story now lives in the Income Calendar card next to it.

import { motion, useReducedMotion } from "framer-motion";

export interface HeroIncomeCardProps {
  incomeAnnualGbp: number;
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
      className="card-surface overflow-hidden"
      style={{
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
    </div>
  );
}

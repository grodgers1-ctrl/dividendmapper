"use client";

// Dashboard "Value vs cost" card — total GBP portfolio value vs cost basis,
// with the signed unrealised P/L as the hero number and a diverging bar
// anchored at a zero centre-line. Bar pattern intentionally mirrors
// SignalContributionsList so the dashboard reads as one visual family.
//
// Bar saturates at ±50% P/L — outsized gains (rare) pin the bar at full
// width; the £ figure carries the absolute. Cost ≤ 0 → empty-state.

import { motion, useReducedMotion } from "framer-motion";

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
const BAR_SATURATION = 0.5; // ±50% P/L pins the bar at full width

export interface ValueVsCostCardProps {
  valueGbp: number;
  costGbp: number;
}

export function ValueVsCostCard({ valueGbp, costGbp }: ValueVsCostCardProps) {
  const reduce = useReducedMotion();

  if (!(costGbp > 0)) {
    return (
      <div className="card-surface flex h-full flex-col">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Value vs cost
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Cost basis collecting. Add avg-cost to your holdings to see P/L.
        </p>
      </div>
    );
  }

  const delta = valueGbp - costGbp;
  const pct = delta / costGbp;
  const positive = delta >= 0;
  const tone = positive ? "text-positive" : "text-negative";
  const sign = positive ? "+" : "−";

  const fraction = Math.max(-1, Math.min(1, pct / BAR_SATURATION));
  const barLeftPct = positive ? 50 : 50 + fraction * 50;
  const barWidthPct = Math.abs(fraction) * 50;

  return (
    <div className="card-surface flex h-full flex-col">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Value vs cost
      </p>
      <p
        className={`mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums ${tone}`}
      >
        {sign}
        {GBP.format(Math.round(Math.abs(delta)))}
        <span className="ml-2 text-base font-medium">
          ({PCT_1DP.format(Math.abs(pct))})
        </span>
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {GBP.format(Math.round(valueGbp))}{" "}
        <span className="opacity-60">·</span> cost basis{" "}
        {GBP.format(Math.round(costGbp))}
      </p>

      <div className="mt-5 flex-1">
        <div className="relative h-2 rounded-full bg-[var(--surface-2)]">
          <div
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-px bg-[var(--border)]"
          />
          <motion.div
            aria-hidden
            data-testid="value-vs-cost-bar"
            className="absolute inset-y-0 rounded-full"
            style={{
              backgroundColor: positive
                ? "var(--positive)"
                : "var(--negative)",
              left: `${barLeftPct}%`,
              width: `${barWidthPct}%`,
            }}
            initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: reduce ? 0 : 0.5,
              ease: EASE,
            }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-[var(--text-muted)]">
          <span>−50%</span>
          <span>0</span>
          <span>+50%</span>
        </div>
      </div>
    </div>
  );
}

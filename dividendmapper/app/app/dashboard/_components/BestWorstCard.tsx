"use client";

// Dashboard "Best & Worst position" card. Two tiles side-by-side: best and
// worst lifetime P/L vs cost, ranked by GBP pct (not delta). Each tile is a
// link into the per-ticker page where the full position view + signal
// breakdown lives. Pro-only.
//
// Honest scope is lifetime P/L, not month-to-date — we don't snapshot
// historical prices yet. If either tile is cross-currency we surface the
// "FX as of today" caveat at the card foot, mirroring PositionCard.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { HoldingPnl } from "@/lib/portfolio/holding-pnl";

const EASE = [0.22, 1, 0.36, 1] as const;

const PCT_FMT = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

const GBP_FMT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export interface BestWorstCardProps {
  pnls: HoldingPnl[];
}

export function BestWorstCard({ pnls }: BestWorstCardProps) {
  const reduce = useReducedMotion();

  if (pnls.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Best & worst
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          P/L collecting — add cost data to your holdings to see best &amp; worst.
        </p>
      </div>
    );
  }

  // Rank by pct, not delta — a £10k gain on a £200k position is less
  // celebratory than a £200 gain on a £400 position.
  const sorted = [...pnls].sort((a, b) => b.pctGbp - a.pctGbp);
  const best = sorted[0];
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  const fxCaveat = best.isCrossCurrency || worst?.isCrossCurrency === true;

  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Best &amp; worst
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile
          testId="best-worst-best"
          eyebrow="Best"
          pnl={best}
          delay={0}
          reduce={!!reduce}
        />
        {worst ? (
          <Tile
            testId="best-worst-worst"
            eyebrow="Worst"
            pnl={worst}
            delay={0.1}
            reduce={!!reduce}
          />
        ) : (
          <div className="flex items-center rounded-[8px] border border-dashed border-[var(--border-subtle)] p-4 text-xs text-[var(--text-muted)]">
            Add more holdings to see comparisons.
          </div>
        )}
      </div>
      {fxCaveat && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Cross-currency rows converted at FX today; the figures drift with FX as well as price.
        </p>
      )}
    </div>
  );
}

function Tile({
  testId,
  eyebrow,
  pnl,
  delay,
  reduce,
}: {
  testId: string;
  eyebrow: "Best" | "Worst";
  pnl: HoldingPnl;
  delay: number;
  reduce: boolean;
}) {
  const positive = pnl.pctGbp >= 0;
  const tone = positive ? "text-positive" : "text-negative";
  return (
    <motion.div
      data-testid={testId}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : delay, ease: EASE }}
    >
      <Link
        href={`/app/portfolio/${pnl.ticker}`}
        className="block rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 transition-colors hover:border-[var(--border)]"
      >
        <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {eyebrow}
        </p>
        <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-[var(--text)]">
          {pnl.ticker}
        </p>
        <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${tone}`}>
          {PCT_FMT.format(pnl.pctGbp)}
        </p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--text-muted)]">
          {GBP_FMT.format(Math.round(pnl.deltaGbp))}
        </p>
      </Link>
    </motion.div>
  );
}

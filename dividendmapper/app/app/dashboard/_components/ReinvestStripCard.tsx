"use client";

// Day 6 dashboard. Pro-only — Free users skip this slot entirely (NOT
// replaced by UpgradeCard, per the one-upgrade-card-per-dashboard rule).
// When no payment is imminent we show a quiet empty state rather than
// hiding the slot, so the row 2 grid doesn't shift.
//
// Optional "Next dividend" callout sits at the top above the reinvest body:
// soonest upcoming ex-div across all held tickers. Independent of the
// reinvest planner window (5 days) so users see a far-future date too.

import { motion, useReducedMotion } from "framer-motion";
import { ReinvestCard } from "@/app/app/portfolio/_components/reinvest-card";
import type { ReinvestCard as ReinvestCardData } from "@/lib/reinvest/build-card";
import type { NextDividend } from "@/lib/scoring/load-portfolio-analytics";

const EASE = [0.22, 1, 0.36, 1] as const;

// timeZone: "UTC" keeps "2026-06-28" rendering as 28 Jun regardless of the
// browser's local timezone — string dates from Supabase carry no zone.
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatShortDate(iso: string): string {
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

export interface ReinvestStripCardProps {
  reinvestCard: ReinvestCardData | null;
  nextDividend?: NextDividend | null;
}

export function ReinvestStripCard({
  reinvestCard,
  nextDividend = null,
}: ReinvestStripCardProps) {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Reinvest planner
      </p>
      {nextDividend && (
        <motion.p
          data-testid="next-dividend-callout"
          className="mt-2 text-xs text-[var(--text-muted)]"
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduce ? 0 : 0.45,
            delay: reduce ? 0 : 0.2,
            ease: EASE,
          }}
        >
          Next dividend:{" "}
          <span className="font-mono text-sm font-semibold text-[var(--text)]">
            {nextDividend.ticker}
          </span>{" "}
          on {formatShortDate(nextDividend.date)}
        </motion.p>
      )}
      {reinvestCard ? (
        <div className="mt-3">
          <ReinvestCard
            trigger={reinvestCard.trigger}
            candidates={reinvestCard.candidates}
          />
        </div>
      ) : (
        <p className="mt-3 flex-1 text-sm text-[var(--text-muted)]">
          No upcoming dividends to plan this week.
        </p>
      )}
    </div>
  );
}

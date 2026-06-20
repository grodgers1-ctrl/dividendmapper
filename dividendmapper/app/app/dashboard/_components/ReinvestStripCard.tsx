// Day 6 dashboard. Pro-only — Free users skip this slot entirely (NOT
// replaced by UpgradeCard, per the one-upgrade-card-per-dashboard rule).
// When no payment is imminent we show a quiet empty state rather than
// hiding the slot, so the row 2 grid doesn't shift.

import { ReinvestCard } from "@/app/app/portfolio/_components/reinvest-card";
import type { ReinvestCard as ReinvestCardData } from "@/lib/reinvest/build-card";

export interface ReinvestStripCardProps {
  reinvestCard: ReinvestCardData | null;
}

export function ReinvestStripCard({ reinvestCard }: ReinvestStripCardProps) {
  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Reinvest planner
      </p>
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

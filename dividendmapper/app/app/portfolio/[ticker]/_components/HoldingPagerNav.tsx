// Day 7 holding detail. Footer row that cycles through the user's holdings
// alpha-sorted: prev (← TICKER) · back to dashboard · next (TICKER →).
// Wraps at the ends (handled upstream by lib/portfolio/holding-neighbours.ts).
// Single-holding users see only the dashboard link.

import Link from "next/link";

export interface HoldingPagerNavProps {
  prev: string | null;
  next: string | null;
  position: number;
  total: number;
}

export function HoldingPagerNav({
  prev,
  next,
  position,
  total,
}: HoldingPagerNavProps) {
  return (
    <nav
      aria-label="Holding pager"
      className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-4 text-sm"
    >
      <div className="flex-1">
        {prev && (
          <Link
            href={`/app/portfolio/${prev}`}
            className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <span aria-hidden>←</span>
            <span className="font-mono">{prev}</span>
          </Link>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 text-xs text-[var(--text-muted)]">
        <Link
          href="/app/dashboard"
          className="hover:text-[var(--text)]"
        >
          Back to dashboard
        </Link>
        {total > 1 && (
          <span aria-live="polite">
            {position} of {total}
          </span>
        )}
      </div>
      <div className="flex-1 text-right">
        {next && (
          <Link
            href={`/app/portfolio/${next}`}
            className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <span className="font-mono">{next}</span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

// Day 5 dashboard. Single upgrade card shown in the FlaggedHolding slot for
// free users — replaces the Pro-only widgets per the "no blur-and-tease"
// rule. Brand-left-rail accent (3px var(--brand)) + headline + 2-3 value
// bullets + primary CTA → /pricing. Copy gets a humaniser pass at the end
// of Day 9; treat the strings here as placeholders.

import Link from "next/link";

const BULLETS = [
  "Quality / Trim / Risk scores on every holding, refreshed nightly",
  "Flagged-card surfaces the position most needing attention",
  "Portfolio Manager quadrant and reinvest planner",
] as const;

export function UpgradeCard() {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-[var(--brand)]"
      />
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Pro
      </p>
      <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-[var(--text)]">
        Unlock resilience scoring
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm text-[var(--text-muted)]">
        {BULLETS.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden className="text-[var(--brand)]">
              •
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Link
          href="/pricing"
          className="inline-flex items-center rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          See pricing →
        </Link>
      </div>
    </div>
  );
}

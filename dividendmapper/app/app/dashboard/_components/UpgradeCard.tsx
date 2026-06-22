// Day 5 dashboard. Single upgrade card shown in the FlaggedHolding slot for
// free users — replaces the Pro-only widgets per the "no blur-and-tease"
// rule. Brand-tinted surround (5% fill + 30% border) + brand-coloured Pro
// eyebrow signals "upgrade prompt" without the generic 3px left-stripe
// SaaS-template cue. Same pattern as the blog post-footer "What to do next"
// callout for consistency.

import Link from "next/link";

const BULLETS = [
  "Quality / Trim / Risk scores on every holding, refreshed nightly",
  "Flagged-card surfaces the position most needing attention",
  "Portfolio Manager quadrant and reinvest planner",
] as const;

export function UpgradeCard() {
  return (
    <div className="rounded-[10px] border border-brand-500/30 bg-brand-500/5 p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-brand-700 dark:text-brand-400">
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

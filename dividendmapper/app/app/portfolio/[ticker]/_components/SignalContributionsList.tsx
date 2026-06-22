// Day 8 holding detail. Per-signal breakdown for one score type
// (Quality / Trim / Risk). Each row shows the signal code (A1/A2/...),
// human label, weight, mini bar centred on zero (±50% width), and the
// signed contribution number. Bar scales in via motion.div on first paint.
// Pro-only consumer — the page renders <UpgradeCard> in this slot for
// Free users.

"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface SignalContributionRow {
  signalCode: string;
  humanLabel: string;
  contribution: number | null;
  weight: number | null;
}

export interface SignalContributionsListProps {
  signals: ReadonlyArray<SignalContributionRow>;
  title: string;
}

const BAR_MAX = 50; // ± points before clipping

function signed(value: number): string {
  if (value >= 0) return `+${value.toFixed(1)}`;
  return `−${Math.abs(value).toFixed(1)}`;
}

// Bare row list (no card wrapper, no title). Used inline by the dashboard's
// FlaggedHoldingCard, which already supplies its own card surround + heading.
export function SignalContributionRows({
  signals,
  compact = false,
}: {
  signals: ReadonlyArray<SignalContributionRow>;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const cols = compact
    ? "grid-cols-[2.25rem_1fr_3rem]"
    : "grid-cols-[2.5rem_1fr_8rem_3.5rem]";

  return (
    <ul className="divide-y divide-[var(--border-subtle)]">
      {signals.map((s, idx) => {
        const value = s.contribution ?? 0;
        const fraction = Math.max(-1, Math.min(1, value / BAR_MAX));
        const positive = value >= 0;
        return (
          <li
            key={`${s.signalCode}-${idx}`}
            data-testid="signal-row"
            className={`grid ${cols} items-center gap-3 py-2 text-sm hover:bg-[var(--surface-2)]`}
          >
            <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
              {s.signalCode}
            </span>
            <span className="truncate text-[var(--text)]">{s.humanLabel}</span>
            {!compact && (
              <div className="relative h-1.5 rounded-full bg-[var(--surface-2)]">
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-1/2 w-px bg-[var(--border)]"
                />
                <motion.div
                  aria-hidden
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    backgroundColor: positive
                      ? "var(--positive)"
                      : "var(--negative)",
                    left: positive ? "50%" : `${50 + fraction * 50}%`,
                    width: `${Math.abs(fraction) * 50}%`,
                  }}
                  initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: reduce ? 0 : 0.4,
                    delay: reduce ? 0 : idx * 0.05,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                />
              </div>
            )}
            <span
              className={`font-mono text-sm tabular-nums ${
                positive ? "text-positive" : "text-negative"
              }`}
            >
              {signed(value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function SignalContributionsList({
  signals,
  title,
}: SignalContributionsListProps) {
  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {title}
      </p>
      {signals.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No signals to break down for this score yet.
        </p>
      ) : (
        <div className="mt-3">
          <SignalContributionRows signals={signals} />
        </div>
      )}
    </div>
  );
}

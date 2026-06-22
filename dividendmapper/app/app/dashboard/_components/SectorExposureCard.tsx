"use client";

// Dashboard sector-exposure card — top-3 sectors by GBP weight + Other.
// Bar pattern intentionally mirrors SignalContributionsList: scaleX from 0
// on first paint, smooth-out ease, per-row stagger. Top-3 fills in brand
// green; Other fills muted so it reads as "the rest, not the story."
//
// Overweight pill (amber) lights up when any sector > 35% — same threshold
// the existing concentration-warning copy uses elsewhere in the app.

import { motion, useReducedMotion } from "framer-motion";
import type { SectorRollup, SectorSlice } from "@/lib/portfolio/sector-exposure";

const EASE = [0.22, 1, 0.36, 1] as const;
const STAGGER = 0.06;
const OVERWEIGHT_THRESHOLD = 0.35;
const PCT_0DP = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

function titleCase(sector: string): string {
  if (sector === "Other" || sector === "Unclassified") return sector;
  return sector
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface SectorExposureCardProps {
  rollup: SectorRollup;
}

export function SectorExposureCard({ rollup }: SectorExposureCardProps) {
  const reduce = useReducedMotion();

  if (rollup.top.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Sector exposure
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Sectors collecting. Check back overnight.
        </p>
      </div>
    );
  }

  const rows: { slice: SectorSlice; isOther: boolean }[] = [
    ...rollup.top.map((s) => ({ slice: s, isOther: false })),
    ...(rollup.other ? [{ slice: rollup.other, isOther: true }] : []),
  ];

  const overweight =
    rollup.max && rollup.max.weight > OVERWEIGHT_THRESHOLD ? rollup.max : null;

  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Sector exposure
      </p>

      {overweight && (
        <div className="mt-2">
          <span
            data-testid="sector-overweight-pill"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
          >
            <span aria-hidden>⚠</span>
            {titleCase(overweight.sector)} is {PCT_0DP.format(overweight.weight)} of portfolio
          </span>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {rows.map((row, idx) => {
          const widthPct = Math.max(0, Math.min(100, row.slice.weight * 100));
          return (
            <li
              key={row.slice.sector}
              className="grid grid-cols-[1fr_minmax(0,3fr)_3rem] items-center gap-3"
            >
              <span className="truncate font-display text-sm text-[var(--text)]">
                {titleCase(row.slice.sector)}
              </span>
              <div className="relative h-1.5 rounded-full bg-[var(--surface-2)]">
                <motion.div
                  aria-hidden
                  className="absolute inset-y-0 left-0 origin-left rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: row.isOther
                      ? "var(--text-muted)"
                      : "var(--brand)",
                    opacity: row.isOther ? 0.4 : 1,
                  }}
                  initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: reduce ? 0 : 0.5,
                    delay: reduce ? 0 : idx * STAGGER,
                    ease: EASE,
                  }}
                />
              </div>
              <span className="text-right font-mono text-sm tabular-nums text-[var(--text)]">
                {PCT_0DP.format(row.slice.weight)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

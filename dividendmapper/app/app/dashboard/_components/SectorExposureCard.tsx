"use client";

// Dashboard sector-exposure card — doughnut + side legend. Top-5 + a
// "Smaller Sectors" tail bucket (`rollupSectors` default). The doughnut is
// pure SVG via stroke-dasharray; no chart library. Brand emerald for the
// largest slice, descending neutral palette for the rest. Centre shows the
// sector count. Overweight pill (amber) fires when any sector weight > 0.35
// — same threshold the rest of the app uses.

import type { SectorRollup, SectorSlice } from "@/lib/portfolio/sector-exposure";
import { formatSector } from "@/lib/scoring/sector-display";

const OVERWEIGHT_THRESHOLD = 0.35;

const PCT_0DP = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

// Slice fills in display order (largest first). Brand emerald → desaturated
// supporting palette. The tail bucket always uses the dimmest slate.
const SLICE_COLOURS = [
  "#22c55e", // brand emerald — leader
  "#818cf8", // indigo
  "#fbbf24", // amber
  "#fb7185", // rose
  "#94a3b8", // slate
  "#475569", // deep slate — tail
] as const;

const RADIUS = 50;
const STROKE_WIDTH = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 314.159

export interface SectorExposureCardProps {
  rollup: SectorRollup;
}

export function SectorExposureCard({ rollup }: SectorExposureCardProps) {
  if (rollup.top.length === 0) {
    return (
      <div className="card-surface flex h-full flex-col">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Sector exposure
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Sectors collecting. Check back overnight.
        </p>
      </div>
    );
  }

  const slices: SectorSlice[] = [
    ...rollup.top,
    ...(rollup.other ? [rollup.other] : []),
  ];

  // Cumulative offsets walked clockwise from 12 o'clock.
  let cumulative = 0;
  const sliceMeta = slices.map((s, i) => {
    const arc = s.weight * CIRCUMFERENCE;
    const offset = -cumulative;
    cumulative += arc;
    return {
      ...s,
      colour: SLICE_COLOURS[Math.min(i, SLICE_COLOURS.length - 1)],
      arc,
      offset,
    };
  });

  const overweight =
    rollup.max && rollup.max.weight > OVERWEIGHT_THRESHOLD ? rollup.max : null;

  return (
    <div className="card-surface flex h-full flex-col">
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
            {formatSector(overweight.sector)} is {PCT_0DP.format(overweight.weight)} of portfolio
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-[120px_1fr] gap-4 items-center">
        <svg
          viewBox="0 0 140 140"
          width="120"
          height="120"
          aria-hidden="true"
        >
          <g transform="translate(70 70) rotate(-90)">
            {sliceMeta.map((s) => (
              <circle
                key={s.sector}
                r={RADIUS}
                fill="none"
                stroke={s.colour}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${s.arc.toFixed(2)} ${(CIRCUMFERENCE - s.arc).toFixed(2)}`}
                strokeDashoffset={s.offset.toFixed(2)}
              />
            ))}
          </g>
          <g transform="translate(70 78)" textAnchor="middle">
            <text
              fontSize="26"
              fontWeight="500"
              fill="var(--text)"
            >
              {slices.length}
            </text>
            <text
              y="14"
              fontSize="10"
              letterSpacing="0.06em"
              fill="var(--text-muted)"
              style={{ textTransform: "uppercase" }}
            >
              sectors
            </text>
          </g>
        </svg>

        <ul className="space-y-1">
          {sliceMeta.map((s) => (
            <li
              key={s.sector}
              className="flex items-center gap-2 text-sm text-[var(--text)]"
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.colour }}
              />
              <span className="min-w-0 flex-1 truncate">{formatSector(s.sector)}</span>
              <span className="font-mono tabular-nums text-[var(--text-muted)]">
                {PCT_0DP.format(s.weight)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

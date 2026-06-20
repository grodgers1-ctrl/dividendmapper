// Day 8 holding detail. 30-day Q/T/R line chart from equity_score_history.
// SVG, deterministic. Graticule at 0/25/50/75/100 keeps the eye honest
// about absolute levels. Three motion.paths animate in with sequential
// delays on first paint (server-rendered SSR shows the final state;
// motion hydrates and replays the draw-in).

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { arcStrokeColor } from "@/lib/scoring/orb-display";

export interface ScoreHistoryPoint {
  date: string; // ISO yyyy-mm-dd
  buy: number | null;
  trim: number | null;
  risk: number | null;
}

export interface ScoreHistoryChartProps {
  series: ReadonlyArray<ScoreHistoryPoint>;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 200;
const PADDING_X = 16;
const PADDING_Y = 16;
const Y_TICKS = [0, 25, 50, 75, 100] as const;
const SERIES: { key: "buy" | "trim" | "risk"; label: string; delay: number }[] = [
  { key: "buy", label: "Quality", delay: 0 },
  { key: "trim", label: "Trim", delay: 0.1 },
  { key: "risk", label: "Risk", delay: 0.2 },
];

function buildPath(
  points: ReadonlyArray<ScoreHistoryPoint>,
  key: "buy" | "trim" | "risk",
  innerWidth: number,
  innerHeight: number,
): string | null {
  const xy: Array<[number, number]> = [];
  const n = points.length;
  if (n === 0) return null;
  for (let i = 0; i < n; i += 1) {
    const value = points[i][key];
    if (value === null) continue;
    const x =
      n === 1 ? innerWidth / 2 : PADDING_X + (i / (n - 1)) * innerWidth;
    const y = PADDING_Y + (1 - value / 100) * innerHeight;
    xy.push([x, y]);
  }
  if (xy.length === 0) return null;
  return xy
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

export function ScoreHistoryChart({
  series,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: ScoreHistoryChartProps) {
  const reduce = useReducedMotion();
  const innerWidth = width - PADDING_X * 2;
  const innerHeight = height - PADDING_Y * 2;

  if (series.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Score history
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          History collecting — 30 days of score data accrues from the nightly
          scoring run.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Score history (30d)
        </p>
        <ul className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: arcStrokeColor(s.key) }}
              />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        aria-label="30-day Quality, Trim and Risk score history"
        className="mt-3"
      >
        <g data-testid="score-history-graticule">
          {Y_TICKS.map((tick) => {
            const y = PADDING_Y + (1 - tick / 100) * innerHeight;
            const isBold = tick === 50;
            return (
              <line
                key={tick}
                x1={PADDING_X}
                y1={y}
                x2={PADDING_X + innerWidth}
                y2={y}
                stroke={isBold ? "var(--border)" : "var(--border-subtle)"}
                strokeWidth={isBold ? 1 : 0.5}
              />
            );
          })}
        </g>
        {SERIES.map((s) => {
          const d = buildPath(series, s.key, innerWidth, innerHeight);
          if (!d) return null;
          const stroke = arcStrokeColor(s.key);
          return (
            <motion.path
              key={s.key}
              data-testid="score-history-line"
              d={d}
              stroke={stroke}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: reduce ? 0 : 0.7,
                delay: reduce ? 0 : s.delay,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

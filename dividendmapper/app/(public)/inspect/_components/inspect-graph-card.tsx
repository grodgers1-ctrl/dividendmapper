"use client";

// Real SVG chart for one Inspect dimension (Value, Safety, Growth,
// Profitability). Three metric lines drawn against percentile-of-own-history
// (0..1 mapped to y), with a Today marker, hover crosshair + tooltip, and
// year ticks along the x axis. Catmull-Rom paths smooth the typically-noisy
// monthly/quarterly cadence without misleading interpolation.

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { catmullRomPath } from "@/lib/inspect/svg-path";
import type {
  InspectMetricFormat,
  InspectMetricSeries,
} from "@/lib/inspect/types";

type Props = {
  title: string;
  subtitle: string;
  verdict: string;
  metrics: [InspectMetricSeries, InspectMetricSeries, InspectMetricSeries];
  windowYears: 3 | 5 | 10;
};

const WIDTH = 400;
const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 24, left: 12 } as const;

function formatValue(v: number | null, fmt: InspectMetricFormat): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  switch (fmt) {
    case "pct":
      return `${(v * 100).toFixed(0)}%`;
    case "pct1":
      return `${(v * 100).toFixed(1)}%`;
    case "multiple":
      return `${v.toFixed(1)}x`;
    case "ratio":
      return v.toFixed(2);
  }
}

type ProjectedPoint = {
  x: number;
  y: number;
  at: string;
  raw: number | null;
  percentile: number | null;
};

function projectPoints(
  points: InspectMetricSeries["points"],
  cutoffMs: number,
): ProjectedPoint[] {
  // points arrives newest-first. Filter to those inside the window with a
  // computable percentile (the band helper returns null when raw is null).
  // Guard against NaN percentile (can leak through if upstream raw was NaN
  // rather than null — e.g. computeFcfPayoutTtm divide-by-zero edge cases).
  const filtered = points.filter(
    (p) =>
      new Date(p.at).getTime() >= cutoffMs &&
      p.percentile !== null &&
      Number.isFinite(p.percentile),
  );
  if (filtered.length === 0) return [];
  const newestMs = new Date(filtered[0].at).getTime();
  const oldestMs = new Date(filtered[filtered.length - 1].at).getTime();
  const spanMs = Math.max(1, newestMs - oldestMs);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  // Render oldest-to-newest left-to-right.
  return [...filtered].reverse().map((p) => {
    const tMs = new Date(p.at).getTime();
    const x = PAD.left + ((tMs - oldestMs) / spanMs) * plotW;
    const pct = p.percentile ?? 0;
    const y = PAD.top + (1 - pct) * plotH;
    return { x, y, at: p.at, raw: p.raw, percentile: p.percentile };
  });
}

export function InspectGraphCard({
  title,
  subtitle,
  verdict,
  metrics,
  windowYears,
}: Props) {
  const reduce = useReducedMotion();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(metrics.map((m) => m.key)),
  );
  const [hoverX, setHoverX] = useState<number | null>(null);

  const cutoffMs = useMemo(
    () => Date.now() - windowYears * 365 * 24 * 60 * 60 * 1000,
    [windowYears],
  );

  const linesData = useMemo(
    () =>
      metrics.map((m) => ({
        ...m,
        pts: projectPoints(m.points, cutoffMs),
      })),
    [metrics, cutoffMs],
  );

  const yearTicks = useMemo(() => {
    const now = new Date();
    const ticks: Array<{ x: number; label: string }> = [];
    const plotW = WIDTH - PAD.left - PAD.right;
    for (let y = windowYears; y >= 0; y -= 1) {
      const label = `${now.getUTCFullYear() - y}`;
      const x = PAD.left + ((windowYears - y) / windowYears) * plotW;
      ticks.push({ x, label });
    }
    return ticks;
  }, [windowYears]);

  const hovered = useMemo(() => {
    if (hoverX === null) return null;
    const items = linesData
      .filter((l) => selectedKeys.has(l.key))
      .map((l) => {
        if (l.pts.length === 0) return null;
        let best = l.pts[0];
        for (const p of l.pts) {
          if (Math.abs(p.x - hoverX) < Math.abs(best.x - hoverX)) best = p;
        }
        return {
          key: l.key,
          label: l.label,
          format: l.format,
          color: l.color,
          pt: best,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (items.length === 0) return null;
    return { items };
  }, [hoverX, linesData, selectedKeys]);

  const dataQualityWarn = useMemo(() => {
    return metrics.some((m) => {
      const filtered = m.points.filter(
        (p) => new Date(p.at).getTime() >= cutoffMs,
      );
      if (filtered.length === 0) return true;
      const nullRate =
        filtered.filter((p) => p.raw === null).length / filtered.length;
      return nullRate > 0.4;
    });
  }, [metrics, cutoffMs]);

  const midlineY = PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {dataQualityWarn && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
            title="Some metrics in this window are missing more than 40% of their observations."
          >
            Data quality: partial
          </span>
        )}
      </div>
      <p className="mt-3 text-base font-medium text-foreground">{verdict}</p>

      <div className="relative mt-6">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-64 w-full"
          role="img"
          aria-label={`${title} percentile chart`}
          onMouseMove={(e) => {
            const rect = (
              e.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            if (rect.width === 0) return;
            const ratio = WIDTH / rect.width;
            setHoverX((e.clientX - rect.left) * ratio);
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          {/* midline at P50 */}
          <line
            x1={PAD.left}
            y1={midlineY}
            x2={WIDTH - PAD.right}
            y2={midlineY}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="2 4"
          />
          {/* year ticks */}
          {yearTicks.map((t) => (
            <text
              key={t.label}
              x={t.x}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              opacity={0.5}
            >
              {t.label}
            </text>
          ))}
          {/* lines */}
          {linesData.map((l) => {
            if (!selectedKeys.has(l.key) || l.pts.length < 2) return null;
            const d = catmullRomPath(
              l.pts.map((p) => [p.x, p.y] as [number, number]),
            );
            return (
              <motion.path
                key={l.key}
                d={d}
                stroke={l.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: reduce ? 0 : 0.8,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
              />
            );
          })}
          {/* Today markers */}
          {linesData.map((l) => {
            if (!selectedKeys.has(l.key) || l.pts.length === 0) return null;
            const last = l.pts[l.pts.length - 1];
            if (
              !last ||
              !Number.isFinite(last.x) ||
              !Number.isFinite(last.y)
            ) {
              return null;
            }
            return (
              <circle
                key={`mk-${l.key}`}
                cx={last.x}
                cy={last.y}
                r={4}
                fill={l.color}
              />
            );
          })}
          {/* hover crosshair */}
          {hoverX !== null && (
            <line
              x1={hoverX}
              y1={PAD.top}
              x2={hoverX}
              y2={HEIGHT - PAD.bottom}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
          )}
        </svg>
        {hovered && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-border bg-background/95 px-2 py-1 text-xs shadow-sm backdrop-blur">
            {hovered.items.map((it) => {
              const p = it.pt.percentile;
              const hasPct = p !== null && Number.isFinite(p);
              return (
                <div key={it.key} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: it.color }}
                  />
                  <span className="font-medium">{it.label}:</span>
                  <span>{formatValue(it.pt.raw, it.format)}</span>
                  {hasPct && (
                    <span className="text-muted-foreground">
                      P{Math.round((p as number) * 100)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {linesData.map((m) => {
          const isOn = selectedKeys.has(m.key);
          const last = m.pts[m.pts.length - 1];
          const cur = last?.raw ?? null;
          const curPct = last?.percentile ?? null;
          const rangeSuffix =
            m.rangeYears > 0 && m.rangeYears < 10
              ? ` of ${Math.round(m.rangeYears)}y`
              : "";
          return (
            <button
              key={m.key}
              type="button"
              onClick={() =>
                setSelectedKeys((s) => {
                  const next = new Set(s);
                  if (next.has(m.key)) next.delete(m.key);
                  else next.add(m.key);
                  return next;
                })
              }
              className={`flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm transition ${
                isOn ? "" : "opacity-50"
              }`}
              aria-pressed={isOn}
              style={isOn ? { borderColor: m.color } : undefined}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="font-medium">{m.label}</span>
              <span className="text-muted-foreground">
                {formatValue(cur, m.format)}
              </span>
              {curPct !== null && Number.isFinite(curPct) && (
                <span className="text-xs text-muted-foreground">
                  P{Math.round(curPct * 100)}
                  {rangeSuffix}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

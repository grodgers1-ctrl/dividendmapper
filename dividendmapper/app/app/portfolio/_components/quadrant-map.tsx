"use client";

import { Fragment, useMemo, useState } from "react";
import {
  QUADRANT_LABEL,
  QUADRANT_NOTE,
  type ExcludedHolding,
  type Quadrant,
  type QuadrantPoint,
} from "@/lib/scoring/quadrant";
import { TopographyMotif } from "@/components/visual/topography-motif";
import { ScoreDrawer } from "./score-drawer";

// Hand-rolled scatter (positioned dots) rather than a charting lib: matches the
// repo's div-based income chart and renders real DOM nodes that jsdom can test
// (recharts ResponsiveContainer renders zero-size in jsdom).

const QUADRANT_ORDER: Quadrant[] = ["core", "watch", "stable", "review"];

// Brand accent #4: graticule layer behind the scatter. Minor lines at every
// 10% (excluding the 25/50/75 ticks that get bolder treatment) keep the eye
// honest about position; bolder lines + tick labels at 25/50/75/100 anchor
// the chart for quick reading on the dashboard's compact snapshot card.
const MINOR_TICKS = [10, 20, 30, 40, 60, 70, 80, 90] as const;
const BOLD_TICKS = [25, 50, 75] as const;
const AXIS_LABEL_TICKS = [25, 50, 75, 100] as const;

function Graticule() {
  return (
    <svg
      data-testid="quadrant-graticule"
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 -z-[1] h-full w-full"
    >
      {MINOR_TICKS.map((t) => (
        <Fragment key={`minor-${t}`}>
          <line
            x1={t}
            y1={0}
            x2={t}
            y2={100}
            stroke="var(--border-subtle)"
            strokeWidth="0.5"
          />
          <line
            x1={0}
            y1={t}
            x2={100}
            y2={t}
            stroke="var(--border-subtle)"
            strokeWidth="0.5"
          />
        </Fragment>
      ))}
      {BOLD_TICKS.map((t) => (
        <Fragment key={`bold-${t}`}>
          <line
            x1={t}
            y1={0}
            x2={t}
            y2={100}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1={0}
            y1={t}
            x2={100}
            y2={t}
            stroke="var(--border)"
            strokeWidth="1"
          />
        </Fragment>
      ))}
    </svg>
  );
}

function AxisLabels() {
  return (
    <>
      {AXIS_LABEL_TICKS.map((t) => (
        <span
          key={`xlabel-${t}`}
          data-testid="quadrant-axis-label"
          aria-hidden
          className="pointer-events-none absolute font-mono text-[10px] leading-[14px] tracking-wide text-[var(--text-faint)]"
          style={{ left: `${t}%`, bottom: 0, transform: "translate(-50%, 100%)" }}
        >
          {t}
        </span>
      ))}
      {AXIS_LABEL_TICKS.map((t) => (
        <span
          key={`ylabel-${t}`}
          data-testid="quadrant-axis-label"
          aria-hidden
          className="pointer-events-none absolute font-mono text-[10px] leading-[14px] tracking-wide text-[var(--text-faint)]"
          style={{ bottom: `${t}%`, left: 0, transform: "translate(-100%, 50%)" }}
        >
          {t}
        </span>
      ))}
    </>
  );
}

function dotClass(trimElevated: boolean): string {
  return trimElevated
    ? "bg-amber-500/80 ring-amber-600"
    : "bg-brand-500/80 ring-brand-600";
}

function dotGlow(trimElevated: boolean): string {
  return trimElevated ? "var(--shadow-glow-trim)" : "var(--shadow-glow-quality)";
}

// Each holding gets a hairline edge to its k nearest neighbours. Edges are
// deduplicated by sorted-ticker-pair so we render each line once. Pure
// geometric — no force layout, no transitions.
function buildEdges(points: QuadrantPoint[], k = 3): { a: QuadrantPoint; b: QuadrantPoint }[] {
  if (points.length < 2) return [];
  const seen = new Set<string>();
  const edges: { a: QuadrantPoint; b: QuadrantPoint }[] = [];
  for (const p of points) {
    const others = points
      .filter((o) => o.ticker !== p.ticker)
      .map((o) => ({ o, d: (o.x - p.x) ** 2 + (o.y - p.y) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    for (const { o } of others) {
      const key = p.ticker < o.ticker ? `${p.ticker}|${o.ticker}` : `${o.ticker}|${p.ticker}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a: p, b: o });
      }
    }
  }
  return edges;
}

export function QuadrantMap({
  points,
  excluded,
  isBeta,
  compact = false,
}: {
  points: QuadrantPoint[];
  excluded: ExcludedHolding[];
  isBeta: boolean;
  /**
   * Compact mode (dashboard QuadrantSnapshotCard): drops the section header
   * and tightens padding so the parent card supplies the surround.
   */
  compact?: boolean;
}) {
  const [openTicker, setOpenTicker] = useState<string | null>(null);
  const edges = useMemo(() => buildEdges(points), [points]);

  const sectionPadding = compact
    ? "p-2"
    : "rounded-xl border border-border bg-card p-4 md:p-6";
  const labelClass = compact
    ? "pointer-events-none absolute translate-y-1/2 whitespace-nowrap rounded bg-background/70 px-0.5 font-mono text-[10px] font-medium text-foreground"
    : "pointer-events-none absolute translate-y-1/2 whitespace-nowrap rounded bg-background/70 px-0.5 font-mono text-[11px] font-medium text-foreground";

  return (
    <section
      aria-label="Quality and risk map"
      data-quadrant-root
      data-compact={compact ? "true" : "false"}
      className={sectionPadding}
    >
      {!compact && (
        <header className="mb-4">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Quality and risk map
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each holding placed by Quality and Risk. Bubble size reflects its share
            of your portfolio. Amber marks an elevated Trim signal. Not financial advice.
          </p>
        </header>
      )}

      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No scored holdings to map yet. Holdings that clear the quality gate
            appear here after the nightly update.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop scatter */}
          <div className="hidden md:block">
            <div className="flex">
              <div
                className="flex items-center justify-center pr-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Quality →
              </div>
              <div
                data-testid="quadrant-scatter"
                className="relative isolate aspect-square w-full max-w-xl overflow-hidden rounded-lg border border-border bg-background"
              >
                <TopographyMotif
                  intensity="subtle"
                  className="absolute inset-0 -z-10 h-full w-full opacity-70"
                />
                <Graticule />
                <AxisLabels />
                {/* quadrant divider lines */}
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
                {/* nearest-neighbour mesh edges (hairline, pointer-events-none) */}
                <svg
                  aria-hidden
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  {edges.map(({ a, b }) => (
                    <line
                      key={`${a.ticker}-${b.ticker}`}
                      x1={a.x}
                      y1={100 - a.y}
                      x2={b.x}
                      y2={100 - b.y}
                      stroke="var(--mesh-strong)"
                      strokeWidth={0.25}
                      strokeOpacity={0.7}
                    />
                  ))}
                </svg>
                {/* corner labels */}
                <span className="absolute left-2 top-2 text-xs font-medium text-muted-foreground">
                  {QUADRANT_LABEL.core}
                </span>
                <span className="absolute right-2 top-2 text-xs font-medium text-muted-foreground">
                  {QUADRANT_LABEL.watch}
                </span>
                <span className="absolute bottom-2 left-2 text-xs font-medium text-muted-foreground">
                  {QUADRANT_LABEL.stable}
                </span>
                <span className="absolute bottom-2 right-2 text-xs font-medium text-muted-foreground">
                  {QUADRANT_LABEL.review}
                </span>
                {points.map((p) => (
                  <Fragment key={p.ticker}>
                    <button
                      type="button"
                      onClick={() => setOpenTicker(p.ticker)}
                      aria-label={`${p.ticker}: Quality ${p.y}, Risk ${p.x}. Open score detail.`}
                      title={`${p.ticker} · Quality ${p.y} · Risk ${p.x}${p.trim !== null ? ` · Trim ${p.trim}` : ""}`}
                      className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-1 ring-inset transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring ${dotClass(p.trimElevated)}`}
                      style={{
                        left: `${p.x}%`,
                        bottom: `${p.y}%`,
                        width: `${p.radius * 2}px`,
                        height: `${p.radius * 2}px`,
                        boxShadow: dotGlow(p.trimElevated),
                      }}
                    />
                    <span
                      aria-hidden
                      className={labelClass}
                      style={{
                        left: `${p.x}%`,
                        bottom: `${p.y}%`,
                        marginLeft: `${p.radius + 5}px`,
                      }}
                    >
                      {p.ticker}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
            <p className="mt-2 pl-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Risk →
            </p>
          </div>

          {/* Mobile fallback: grouped sorted list */}
          <div className="space-y-4 md:hidden">
            {QUADRANT_ORDER.map((q) => {
              const inQ = points
                .filter((p) => p.quadrant === q)
                .sort((a, b) => b.y - a.y);
              if (inQ.length === 0) return null;
              return (
                <div key={q}>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {QUADRANT_LABEL[q]} · {QUADRANT_NOTE[q]}
                  </p>
                  <ul className="mt-1 divide-y divide-border">
                    {inQ.map((p) => (
                      <li key={p.ticker}>
                        <button
                          type="button"
                          onClick={() => setOpenTicker(p.ticker)}
                          aria-label={`${p.ticker}: Quality ${p.y}, Risk ${p.x}. Open score detail.`}
                          className="flex w-full items-center justify-between py-2 text-left"
                        >
                          <span className="font-mono text-sm font-medium text-foreground">
                            {p.ticker}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            Q {p.y} · R {p.x}
                            {p.trimElevated ? " · Trim ↑" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {excluded.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Not on the map
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No Quality score, so these sit off the map. Sorted by Risk.
          </p>
          <ul className="mt-2 divide-y divide-border">
            {excluded.map((e) => (
              <li
                key={e.ticker}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-medium text-foreground">
                    {e.ticker}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {e.collecting ? "—" : `R ${e.risk} · T ${e.trim ?? "—"}`}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{e.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openTicker && (
        <ScoreDrawer
          ticker={openTicker}
          scoreType="buy"
          open={true}
          onOpenChange={(o) => {
            if (!o) setOpenTicker(null);
          }}
          isBeta={isBeta}
        />
      )}
    </section>
  );
}

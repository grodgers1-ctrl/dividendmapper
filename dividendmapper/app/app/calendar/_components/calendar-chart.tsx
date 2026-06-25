"use client";

// 18-month chart (6 back + current + 12 forward = 19 buckets) with
// stack-aware bars, locale-aware y-axis ticks, and a hover tooltip showing
// the month's total + per-segment breakdown. Pure presentational — receives
// buckets from buildIncomeCalendar.

import { useState } from "react";
import type { IncomeCalendarMonth, SegmentKind } from "@/lib/portfolio/income-calendar";

const MONTH_LABEL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_LABEL[m - 1] ?? ym;
}

const OPACITY: Record<SegmentKind, number> = {
  "actual": 1,
  "partial": 0.7,
  "confirmed-forecast": 0.55,
  "projected-cadence": 0.45,
  "projected-growth": 0.5,
  "growth-clipped": 0.5,
  "fmp-estimate": 0.35,
};

const SEGMENT_LABEL: Record<SegmentKind, string> = {
  "actual": "Received",
  "partial": "Received MTD",
  "confirmed-forecast": "Confirmed",
  "projected-cadence": "Projected",
  "projected-growth": "Projected (growth)",
  "growth-clipped": "Projected (capped)",
  "fmp-estimate": "Estimate",
};

const NUMBER_FMT_GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const NUMBER_FMT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatAxis(n: number, currency: "GBP" | "USD"): string {
  const fmt = currency === "USD" ? NUMBER_FMT_USD : NUMBER_FMT_GBP;
  return fmt.format(Math.round(n));
}

export interface CalendarChartProps {
  months: ReadonlyArray<IncomeCalendarMonth>;
  onSelectMonth: (ym: string) => void;
  selectedYm?: string;
  /** Used to format y-axis ticks + tooltip totals. Defaults to GBP for the
   * legacy dashboard caller that doesn't pass it. */
  primaryCurrency?: "GBP" | "USD";
  /** Renders the "incl. projected" caveat pill below the chart legend. */
  includesProjected?: boolean;
}

export function CalendarChart({
  months,
  onSelectMonth,
  selectedYm,
  primaryCurrency = "GBP",
  includesProjected = false,
}: CalendarChartProps) {
  const [hoveredYm, setHoveredYm] = useState<string | null>(null);
  const max = months.reduce((m, b) => (b.gbp > m ? b.gbp : m), 0);
  const partialIndex = months.findIndex((m) => m.kind === "partial");
  const dividerLeft =
    partialIndex >= 0
      ? `${((partialIndex + 1) / months.length) * 100}%`
      : null;

  const hovered = hoveredYm
    ? months.find((m) => m.ym === hoveredYm)
    : null;
  const hoveredIndex = hovered ? months.indexOf(hovered) : -1;
  const tooltipLeft =
    hoveredIndex >= 0
      ? `${((hoveredIndex + 0.5) / months.length) * 100}%`
      : null;

  return (
    <div data-testid="calendar-chart-root" data-respect-reduced-motion="true">
      <div className="flex gap-2">
        <div
          data-testid="calendar-y-axis"
          className="flex w-10 flex-col justify-between pt-2 pb-1 text-right text-[9px] tabular-nums text-[var(--text-muted)]"
          style={{ height: "220px" }}
          aria-hidden="true"
        >
          <span data-testid="calendar-y-tick-max">{formatAxis(max, primaryCurrency)}</span>
          <span data-testid="calendar-y-tick-mid">{formatAxis(max / 2, primaryCurrency)}</span>
          <span data-testid="calendar-y-tick-zero">{formatAxis(0, primaryCurrency)}</span>
        </div>
        <section
          role="figure"
          aria-label="Income calendar 18-month chart"
          className="relative h-[220px] flex flex-1 items-end gap-1.5 border-b border-[var(--border-subtle)]"
        >
          {months.map((m, idx) => {
            const heightPct = max > 0 ? Math.max(4, (m.gbp / max) * 100) : 4;
            return (
              <button
                key={m.ym}
                type="button"
                data-testid={`calendar-bar-${m.ym}`}
                onClick={() => onSelectMonth(m.ym)}
                onMouseEnter={() => setHoveredYm(m.ym)}
                onMouseLeave={() => setHoveredYm((cur) => (cur === m.ym ? null : cur))}
                onFocus={() => setHoveredYm(m.ym)}
                onBlur={() => setHoveredYm((cur) => (cur === m.ym ? null : cur))}
                aria-pressed={selectedYm === m.ym}
                aria-label={`${monthName(m.ym)} ${m.ym}: ${formatAxis(m.gbp, primaryCurrency)}`}
                className="calendar-bar-anim relative flex-1 flex flex-col-reverse"
                style={
                  {
                    height: `${heightPct}%`,
                    "--calendar-bar-delay": `${idx * 20}ms`,
                  } as React.CSSProperties
                }
              >
                {m.gbp > 0 && (
                  <span
                    data-testid={`calendar-bar-value-${m.ym}`}
                    aria-hidden
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-medium tabular-nums text-[var(--text-muted)]"
                  >
                    {formatAxis(m.gbp, primaryCurrency)}
                  </span>
                )}
                {m.segments.map((seg, i) => {
                  const segHeight = max > 0 && m.gbp > 0 ? (seg.primary / m.gbp) * 100 : 0;
                  const isProjected =
                    seg.kind === "projected-cadence" ||
                    seg.kind === "projected-growth" ||
                    seg.kind === "growth-clipped";
                  return (
                    <span
                      key={`${m.ym}-${seg.kind}-${i}`}
                      data-testid="calendar-bar-segment"
                      data-kind={seg.kind}
                      className="relative block w-full first:rounded-t-sm"
                      style={{
                        height: `${segHeight}%`,
                        backgroundColor: "var(--brand)",
                        backgroundImage: isProjected
                          ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 3px, transparent 3px, transparent 8px)"
                          : undefined,
                        opacity: OPACITY[seg.kind],
                      }}
                    >
                      {seg.kind === "growth-clipped" && (
                        <span
                          data-testid="growth-clipped-glyph"
                          aria-hidden
                          title="Growth rate capped at ±20%/yr"
                          className="absolute right-0 top-0 -translate-y-1/2 text-[10px] leading-none text-[var(--text)]"
                        >
                          ⚠
                        </span>
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
          {dividerLeft !== null && (
            <div
              data-testid="today-divider"
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 flex items-start"
              style={{ left: dividerLeft }}
            >
              <span className="-translate-x-1/2 rounded-sm bg-[var(--brand)] px-1 text-[9px] font-medium uppercase text-white">
                today
              </span>
              <span className="absolute top-3 bottom-0 left-0 border-l border-dashed border-[var(--border)]" />
            </div>
          )}
          {hovered && tooltipLeft !== null && (
            <div
              data-testid="calendar-tooltip"
              role="tooltip"
              className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--text)] shadow-md"
              style={{ left: tooltipLeft }}
            >
              <p className="font-medium">
                {monthName(hovered.ym)} {hovered.ym.slice(0, 4)}
              </p>
              <p
                data-testid="calendar-tooltip-total"
                className="font-mono tabular-nums text-[var(--text)]"
              >
                {formatAxis(hovered.gbp, primaryCurrency)}
              </p>
              {hovered.segments.length > 1 && (
                <ul className="mt-1 space-y-0.5 text-[var(--text-muted)]">
                  {hovered.segments.map((s, i) => (
                    <li key={`${s.kind}-${i}`} className="flex gap-2">
                      <span className="flex-1">{SEGMENT_LABEL[s.kind]}</span>
                      <span className="tabular-nums">{formatAxis(s.primary, primaryCurrency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
      <div className="ml-12 mt-1.5 flex gap-1.5">
        {months.map((m) => (
          <span
            key={m.ym}
            data-testid="calendar-month-label"
            className={`flex-1 text-center text-[10px] tabular-nums ${
              m.kind === "partial"
                ? "text-[var(--text)] font-semibold"
                : "text-[var(--text-muted)]"
            }`}
          >
            {monthName(m.ym)}
          </span>
        ))}
      </div>
      <div
        data-testid="calendar-legend"
        className="ml-12 mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-muted)]"
      >
        <LegendSwatch label="Received" variant="solid" />
        <LegendSwatch label="Confirmed" variant="muted" />
        <LegendSwatch label="Projected" variant="striped" />
        {includesProjected && (
          <span
            data-testid="calendar-incl-projected-pill"
            className="ml-auto rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]"
          >
            incl. projected
          </span>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({
  label,
  variant,
}: {
  label: string;
  variant: "solid" | "muted" | "striped";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-3 rounded-sm"
        style={{
          backgroundColor: "var(--brand)",
          opacity: variant === "solid" ? 1 : variant === "muted" ? 0.55 : 0.5,
          backgroundImage:
            variant === "striped"
              ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 3px, transparent 3px, transparent 8px)"
              : undefined,
        }}
      />
      {label}
    </span>
  );
}

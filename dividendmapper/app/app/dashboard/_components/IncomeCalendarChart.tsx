"use client";

// Rolling income chart. Past-actual bars are solid brand emerald; the current
// partial month is 70% opacity; future forecast bars are 40% opacity. A light
// top-to-bottom gradient + inset shadow gives the bars a subtle 3D feel. A
// compact GBP Y-axis (sm+) with two faint scale lines makes bar heights
// legible; a dashed 'today' divider sits between the current and next bar.
// Pure presentational — receives the bucketed months from buildIncomeCalendar.

import type { IncomeCalendarMonth } from "@/lib/portfolio/income-calendar";

const MONTH_LABEL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const GBP_FMT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_LABEL[m - 1] ?? ym;
}

const CHART_HEIGHT = 150;

export interface IncomeCalendarChartProps {
  months: ReadonlyArray<IncomeCalendarMonth>;
}

export function IncomeCalendarChart({ months }: IncomeCalendarChartProps) {
  const max = months.reduce((m, b) => (b.gbp > m ? b.gbp : m), 0);
  const partialIndex = months.findIndex((m) => m.kind === "partial");
  // Today divider position: just after the partial month, so at fraction
  // (partialIndex + 1) / months.length of the bars-area width.
  const dividerLeft =
    partialIndex >= 0
      ? `${((partialIndex + 1) / months.length) * 100}%`
      : null;

  const chartLabel = `Rolling income chart: ${months
    .map((m) => `${monthName(m.ym)} ${GBP_FMT.format(Math.round(m.gbp))} (${m.kind})`)
    .join(", ")}`;

  return (
    <div>
      {/* Y-axis (sm+) + bars. The axis is hidden on phones so the bars keep
          full width; the label row below mirrors the same left offset. */}
      <div className="flex gap-2">
        <div
          aria-hidden
          className="hidden w-9 shrink-0 flex-col justify-between text-right text-[9px] tabular-nums text-[var(--text-muted)] sm:flex"
          style={{ height: `${CHART_HEIGHT}px` }}
        >
          <span>{GBP_FMT.format(Math.round(max))}</span>
          <span>{GBP_FMT.format(Math.round(max / 2))}</span>
          <span>{GBP_FMT.format(0)}</span>
        </div>

        <section
          role="figure"
          aria-label={chartLabel}
          className="relative flex flex-1 items-end gap-1.5 border-b border-[var(--border-subtle)]"
          style={{ height: `${CHART_HEIGHT}px` }}
        >
          {/* Two faint scale lines (max + mid), aligned to the Y-axis ticks.
              The 0 line is the section's bottom border. Behind the bars. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 hidden border-t border-[var(--border-subtle)] opacity-60 sm:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 hidden border-t border-[var(--border-subtle)] opacity-60 sm:block"
          />

          {months.map((m) => {
            const heightPct = max > 0 ? Math.max(4, (m.gbp / max) * 100) : 4;
            const opacity =
              m.kind === "actual" ? 1 : m.kind === "partial" ? 0.7 : 0.4;
            return (
              <div
                key={m.ym}
                data-testid="calendar-bar"
                data-kind={m.kind}
                className="relative flex-1 rounded-t-sm"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: "var(--brand)",
                  backgroundImage:
                    "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(0,0,0,0.06))",
                  boxShadow: "inset -1px 0 0 rgba(0,0,0,0.06)",
                  opacity,
                }}
              />
            );
          })}
          {dividerLeft !== null && (
            <div
              data-testid="today-divider"
              aria-hidden="true"
              className="absolute top-0 bottom-0 border-l border-dashed border-[var(--border)]"
              style={{ left: dividerLeft }}
            />
          )}
        </section>
      </div>

      {/* Month labels — offset to sit under the bars (spacer matches the Y-axis
          width on sm+). Rotated vertical on phones so 19 labels fit the narrow
          width; horizontal on md+ where there's room. */}
      <div className="mt-2 flex gap-2">
        <div aria-hidden className="hidden w-9 shrink-0 sm:block" />
        <div className="flex flex-1 gap-1.5">
          {months.map((m) => (
            <span
              key={m.ym}
              className={`flex min-w-0 flex-1 justify-center ${
                m.kind === "partial"
                  ? "text-[var(--text)] font-semibold"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <span className="text-[10px] leading-none tabular-nums [writing-mode:vertical-rl] [transform:rotate(180deg)] md:[writing-mode:horizontal-tb] md:[transform:none]">
                {monthName(m.ym)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-3 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: "var(--brand)" }}
          />
          received
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: "var(--brand)", opacity: 0.4 }}
          />
          forecast
        </span>
      </div>
    </div>
  );
}

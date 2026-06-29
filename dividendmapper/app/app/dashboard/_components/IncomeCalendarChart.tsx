"use client";

// Rolling 12-month income chart. Past-actual bars are solid brand emerald;
// current partial month is 70% opacity; future forecast bars are 40% opacity.
// A dashed 'today' divider sits between the current and next bar. Pure
// presentational — receives the bucketed months from buildIncomeCalendar.

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

export interface IncomeCalendarChartProps {
  months: ReadonlyArray<IncomeCalendarMonth>;
}

export function IncomeCalendarChart({ months }: IncomeCalendarChartProps) {
  const max = months.reduce((m, b) => (b.gbp > m ? b.gbp : m), 0);
  const partialIndex = months.findIndex((m) => m.kind === "partial");
  // Today divider position: just after the partial month, so at fraction
  // (partialIndex + 1) / 12 of the chart width.
  const dividerLeft =
    partialIndex >= 0
      ? `${((partialIndex + 1) / months.length) * 100}%`
      : null;

  const chartLabel = `Rolling 12-month income chart: ${months
    .map((m) => `${monthName(m.ym)} ${GBP_FMT.format(Math.round(m.gbp))} (${m.kind})`)
    .join(", ")}`;

  return (
    <div>
      <section
        role="figure"
        aria-label={chartLabel}
        className="relative h-[130px] flex items-end gap-1.5 border-b border-[var(--border-subtle)]"
      >
        {months.map((m) => {
          const heightPct = max > 0 ? Math.max(4, (m.gbp / max) * 100) : 4;
          const opacity =
            m.kind === "actual" ? 1 : m.kind === "partial" ? 0.7 : 0.4;
          return (
            <div
              key={m.ym}
              data-testid="calendar-bar"
              data-kind={m.kind}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${heightPct}%`,
                backgroundColor: "var(--brand)",
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
      <div className="mt-2 flex gap-1.5">
        {months.map((m) => (
          // The dashboard sits in a 1/3-width column at every viewport, so
          // there's never room for 19 horizontal month labels above bars
          // ~14px wide. Rotating labels vertically gives each one ~12px of
          // line-box width — fits its bar slot, no overflow, all 19 align.
          <span
            key={m.ym}
            className={`flex min-w-0 flex-1 justify-center ${
              m.kind === "partial"
                ? "text-[var(--text)] font-semibold"
                : "text-[var(--text-muted)]"
            }`}
          >
            <span className="text-[10px] leading-none tabular-nums [writing-mode:vertical-rl] [transform:rotate(180deg)]">
              {monthName(m.ym)}
            </span>
          </span>
        ))}
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

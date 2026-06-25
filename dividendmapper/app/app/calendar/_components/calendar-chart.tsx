"use client";

// 18-month chart (6 back + current + 12 forward = 19 buckets) with
// stack-aware bars. Slice A uses 3 segment kinds; Slice B teaches it 3 more.
// Pure presentational — receives buckets from buildIncomeCalendar.

import type { IncomeCalendarMonth, SegmentKind } from "@/lib/portfolio/income-calendar";

const MONTH_LABEL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_LABEL[m - 1] ?? ym;
}

const OPACITY: Record<SegmentKind, number> = {
  "actual": 1,
  "partial": 0.7,
  "confirmed-forecast": 0.4,
  "projected-cadence": 0.3,
  "projected-growth": 0.35,
  "growth-clipped": 0.35,
};

export interface CalendarChartProps {
  months: ReadonlyArray<IncomeCalendarMonth>;
  onSelectMonth: (ym: string) => void;
  selectedYm?: string;
}

export function CalendarChart({ months, onSelectMonth, selectedYm }: CalendarChartProps) {
  const max = months.reduce((m, b) => (b.gbp > m ? b.gbp : m), 0);
  const partialIndex = months.findIndex((m) => m.kind === "partial");
  const dividerLeft =
    partialIndex >= 0
      ? `${((partialIndex + 1) / months.length) * 100}%`
      : null;

  return (
    <div data-testid="calendar-chart-root" data-respect-reduced-motion="true">
      <section
        role="figure"
        aria-label="Income calendar 18-month chart"
        className="relative h-[220px] flex items-end gap-1.5 border-b border-[var(--border-subtle)]"
      >
        {months.map((m) => {
          const heightPct = max > 0 ? Math.max(4, (m.gbp / max) * 100) : 4;
          return (
            <button
              key={m.ym}
              type="button"
              data-testid={`calendar-bar-${m.ym}`}
              onClick={() => onSelectMonth(m.ym)}
              aria-pressed={selectedYm === m.ym}
              aria-label={`${monthName(m.ym)} ${m.ym}`}
              className="flex-1 flex flex-col-reverse"
              style={{ height: `${heightPct}%` }}
            >
              {m.segments.map((seg, i) => {
                const segHeight = max > 0 && m.gbp > 0 ? (seg.primary / m.gbp) * 100 : 0;
                return (
                  <span
                    key={`${m.ym}-${seg.kind}-${i}`}
                    data-testid="calendar-bar-segment"
                    data-kind={seg.kind}
                    className="block w-full first:rounded-t-sm"
                    style={{
                      height: `${segHeight}%`,
                      backgroundColor: "var(--brand)",
                      opacity: OPACITY[seg.kind],
                    }}
                  />
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
      </section>
      <div className="mt-1.5 flex gap-1.5">
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
    </div>
  );
}

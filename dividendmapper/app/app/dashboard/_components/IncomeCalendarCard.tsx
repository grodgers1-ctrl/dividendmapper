"use client";

// Dashboard "Income calendar" band. A full-width row under the projected-income
// hero: a rolling received/forecast chart on the left and the next-3
// ex-dividends on the right, with an "Open full calendar →" link to
// /app/calendar. The inline ReinvestCard moved to the calendar drill-down.

import Link from "next/link";
import type { IncomeCalendarResult } from "@/lib/portfolio/income-calendar";
import { IncomeCalendarChart } from "./IncomeCalendarChart";

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

function formatGbpRounded(gbp: number): string {
  return `~£${Math.round(gbp)}`;
}

export interface IncomeCalendarCardProps {
  calendar: IncomeCalendarResult;
  // Retained for API back-compat with the dashboard page caller. The inline
  // reinvest surface moves to /app/calendar's drill-down in Slice B.
  reinvestCard?: unknown;
}

export function IncomeCalendarCard({ calendar }: IncomeCalendarCardProps) {
  return (
    <div className="card-surface">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Income calendar
        </p>
        <Link
          href="/app/calendar"
          className="text-xs text-[var(--brand)] hover:underline"
        >
          Open full calendar →
        </Link>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <IncomeCalendarChart months={calendar.months} />
        </div>

        <div className="lg:border-l lg:border-[var(--border-subtle)] lg:pl-6">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            Next 3 ex-dividends
          </p>
          <ul className="mt-2">
            {calendar.nextThree.length === 0 ? (
              <li className="text-xs text-[var(--text-muted)]">
                No upcoming ex-dividends in your portfolio yet.
              </li>
            ) : (
            calendar.nextThree.map((row, i) => (
              <li
                key={`${row.ticker}-${row.exDate}`}
                className={`grid grid-cols-[60px_1fr_auto] items-baseline gap-2 py-1.5 text-sm ${
                  i < calendar.nextThree.length - 1
                    ? "border-b border-[var(--border-subtle)]"
                    : ""
                }`}
              >
                <span className="font-mono text-xs font-medium text-[var(--text)]">
                  {row.ticker}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatShortDate(row.exDate)} · pay {formatShortDate(row.payDate)}
                </span>
                <span className="font-mono text-xs tabular-nums text-[var(--text)]">
                  {formatGbpRounded(row.gbp)}
                </span>
              </li>
            ))
          )}
          </ul>
        </div>
      </div>
    </div>
  );
}

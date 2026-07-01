"use client";

// Dashboard "Income calendar" band. A full-width row under the projected-income
// hero: a rolling received/forecast chart on the left and the next few upcoming
// ex-dividends on the right (confirmed + projected, so the list isn't empty when
// only one holding has a confirmed date), with an "Open full calendar →" link to
// /app/calendar. The inline ReinvestCard moved to the calendar drill-down.

import Link from "next/link";
import type { IncomeCalendarResult } from "@/lib/portfolio/income-calendar";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";
import { IncomeCalendarChart } from "./IncomeCalendarChart";

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatShortDate(iso: string): string {
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
  const upcoming = calendar.upcoming.slice(0, 3);

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
            {upcoming.length === 0 ? (
              <li className="text-xs text-[var(--text-muted)]">
                No upcoming ex-dividends in your portfolio yet.
              </li>
            ) : (
              upcoming.map((row, i) => (
                <li
                  key={`${row.ticker}-${row.exDate}`}
                  className={`flex items-center gap-3 py-2 ${
                    i < upcoming.length - 1
                      ? "border-b border-[var(--border-subtle)]"
                      : ""
                  }`}
                >
                  <HoldingLogo ticker={row.ticker} name={row.name} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium text-[var(--text)]">
                        {row.ticker}
                      </span>
                      {row.status === "estimated" && (
                        <span className="rounded bg-[var(--surface-2)] px-1 py-px text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          est.
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatShortDate(row.exDate)}
                      {row.payDate ? ` · pay ${formatShortDate(row.payDate)}` : ""}
                    </span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[var(--text)]">
                    {formatGbpRounded(row.primaryAmount)}
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

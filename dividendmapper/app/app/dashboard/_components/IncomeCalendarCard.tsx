"use client";

// Dashboard "Income calendar" card. Always-on chart of past + forecast
// dividend income; always-on next-3 ex-divs list; inline reinvest
// suggestions appear only when an ex-div is within the 5-day trigger window.
// No empty state — the chart + list fill the card on quiet weeks too.

import { ReinvestCard } from "@/app/app/portfolio/_components/reinvest-card";
import type { ReinvestCard as ReinvestCardData } from "@/lib/reinvest/build-card";
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
  reinvestCard: ReinvestCardData | null;
}

export function IncomeCalendarCard({
  calendar,
  reinvestCard,
}: IncomeCalendarCardProps) {
  return (
    <div className="card-surface flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Income calendar
        </p>
        <span className="text-[10px] text-[var(--text-muted)]">
          past 6 mo · next 6 mo
        </span>
      </div>

      <div className="mt-3">
        <IncomeCalendarChart months={calendar.months} />
      </div>

      <div className="mt-4">
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

      {reinvestCard && (
        <div className="mt-4" data-testid="inline-reinvest">
          <ReinvestCard
            trigger={reinvestCard.trigger}
            candidates={reinvestCard.candidates}
          />
        </div>
      )}
    </div>
  );
}

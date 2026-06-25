"use client";

// Client wrapper for /app/calendar. Two-column grid on desktop:
//   left: toggles + wrapper filter + StatSidebar
//   right: chart + drilldown panel
// Mobile collapses to single column.

import { useMemo, useState } from "react";
import type {
  IncomeCalendarResult,
  IncomeCalendarUserDividend,
  Locale,
  Wrapper,
  WrapperFilter,
} from "@/lib/portfolio/income-calendar";
import { computeNetDividend } from "@/lib/portfolio/dividend-tax";
import { StatSidebar } from "./stat-sidebar";
import { WrapperFilterRow } from "./wrapper-filter-row";
import { CalendarChart } from "./calendar-chart";
import { DrilldownPanel } from "./drilldown-panel";
import { EmptyStateCta } from "./empty-state-cta";

export interface CalendarShellProps {
  locale: Locale;
  calendar: IncomeCalendarResult;
  userDividends: ReadonlyArray<IncomeCalendarUserDividend>;
  ratesToPrimary: Record<string, number>;
  showEmptyStateCta: boolean;
  /** Total portfolio value in the user's primary currency, for the Yield KPI.
   * null when value can't be computed (e.g. quotes unavailable). */
  portfolioValuePrimary?: number | null;
}

export function CalendarShell({
  locale,
  calendar,
  userDividends,
  ratesToPrimary,
  showEmptyStateCta,
  portfolioValuePrimary = null,
}: CalendarShellProps) {
  const [netMode, setNetMode] = useState<"net" | "gross">("net");
  const [yearMode, setYearMode] = useState<"tax" | "calendar">("tax");
  const [wrapperFilter, setWrapperFilter] = useState<WrapperFilter>("all");
  const [selectedYm, setSelectedYm] = useState<string>(() => {
    const partial = calendar.months.find((m) => m.kind === "partial");
    return partial?.ym ?? calendar.months[0]?.ym ?? "";
  });

  const stats = useMemo(
    () =>
      computeStats(
        calendar,
        wrapperFilter,
        netMode,
        locale,
        userDividends,
        ratesToPrimary,
        yearMode,
        portfolioValuePrimary,
      ),
    [calendar, wrapperFilter, netMode, locale, userDividends, ratesToPrimary, yearMode, portfolioValuePrimary],
  );

  const drilldownPayments = useMemo(
    () =>
      (calendar.paymentsByMonth[selectedYm] ?? []).filter(
        (p) => wrapperFilter === "all" || p.wrapper === wrapperFilter,
      ),
    [calendar.paymentsByMonth, selectedYm, wrapperFilter],
  );

  const includesProjected = useMemo(
    () =>
      calendar.months.some((m) =>
        m.segments.some(
          (s) =>
            s.kind === "projected-cadence" ||
            s.kind === "projected-growth" ||
            s.kind === "growth-clipped",
        ),
      ),
    [calendar.months],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[280px_1fr] lg:items-start">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2" data-testid="calendar-header-toggles">
          <ToggleGroup
            label="Net / Gross"
            value={netMode}
            options={[
              { value: "net", label: "Net" },
              { value: "gross", label: "Gross" },
            ]}
            onChange={(v) => setNetMode(v as "net" | "gross")}
          />
          <ToggleGroup
            label="Tax year / Calendar year"
            value={yearMode}
            options={[
              { value: "tax", label: "Tax yr" },
              { value: "calendar", label: "Cal yr" },
            ]}
            onChange={(v) => setYearMode(v as "tax" | "calendar")}
          />
        </div>
        <WrapperFilterRow locale={locale} value={wrapperFilter} onChange={setWrapperFilter} />
        <StatSidebar
          primaryCurrency={calendar.primaryCurrency}
          annualIncome={stats.annualIncome}
          monthlyAverage={stats.monthlyAverage}
          dailyAverage={stats.dailyAverage}
          yieldOnValue={stats.yieldOnValue}
          yetToReceive={stats.yetToReceive}
          includesProjected={includesProjected}
        />
        {showEmptyStateCta && <EmptyStateCta />}
      </div>
      <div className="flex flex-col gap-6">
        <CalendarChart
          months={calendar.months}
          onSelectMonth={setSelectedYm}
          selectedYm={selectedYm}
          primaryCurrency={calendar.primaryCurrency}
          includesProjected={includesProjected}
        />
        <DrilldownPanel
          primaryCurrency={calendar.primaryCurrency}
          payments={drilldownPayments}
          emptyReason={drilldownPayments.length === 0 ? "no-announcement" : undefined}
        />
      </div>
    </div>
  );
}

function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-[var(--border-subtle)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`px-3 py-1 text-xs ${
            o.value === value
              ? "bg-[var(--brand)] text-white"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface Stats {
  annualIncome: number;
  monthlyAverage: number;
  dailyAverage: number;
  yieldOnValue: number | null;
  yetToReceive: number;
}

function computeStats(
  calendar: IncomeCalendarResult,
  filter: WrapperFilter,
  netMode: "net" | "gross",
  locale: Locale,
  userDividends: ReadonlyArray<IncomeCalendarUserDividend>,
  ratesToPrimary: Record<string, number>,
  yearMode: "tax" | "calendar",
  portfolioValuePrimary: number | null,
): Stats {
  // Sum all expected payments in the future (current partial + 12 months
  // forward). Applies wrapper filter + Net/Gross via paymentsByMonth so the
  // numbers stay consistent with what the drilldown shows.
  const partialIdx = calendar.months.findIndex((m) => m.kind === "partial");
  const futureMonths = partialIdx >= 0 ? calendar.months.slice(partialIdx) : calendar.months;
  const todayIso = new Date().toISOString().slice(0, 10);

  let annualIncome = 0;
  let yetToReceive = 0;

  // Tax year / calendar year boundary for the yet-to-receive cutoff.
  const now = new Date();
  let yetCutoffIso: string;
  if (yearMode === "calendar") {
    yetCutoffIso = `${now.getUTCFullYear()}-12-31`;
  } else if (locale === "uk") {
    const thisYearStart = new Date(Date.UTC(now.getUTCFullYear(), 3, 6));
    const start =
      now >= thisYearStart
        ? thisYearStart
        : new Date(Date.UTC(now.getUTCFullYear() - 1, 3, 6));
    const end = new Date(Date.UTC(start.getUTCFullYear() + 1, 3, 5));
    yetCutoffIso = end.toISOString().slice(0, 10);
  } else {
    yetCutoffIso = `${now.getUTCFullYear()}-12-31`;
  }

  for (const month of futureMonths) {
    const entries = (calendar.paymentsByMonth[month.ym] ?? []).filter(
      (p) => filter === "all" || p.wrapper === filter,
    );
    for (const p of entries) {
      if (p.status === "received") continue; // already in YTD/last 12m, not "annual income"
      const net = applyNet(p.primaryAmount, p.wrapper, netMode, locale);
      annualIncome += net;
      const anchor = p.payDate ?? p.exDate;
      if (anchor >= todayIso && anchor <= yetCutoffIso) {
        yetToReceive += net;
      }
    }
  }

  const monthlyAverage = annualIncome / 12;
  const dailyAverage = annualIncome / 365;
  const yieldOnValue =
    portfolioValuePrimary && portfolioValuePrimary > 0
      ? annualIncome / portfolioValuePrimary
      : null;

  // Silence unused-var lint for the user_dividends path; the new
  // paymentsByMonth-driven stats no longer need it. Kept in the signature for
  // future YTD/Last-12mo follow-up tiles.
  void userDividends;
  void ratesToPrimary;

  return { annualIncome, monthlyAverage, dailyAverage, yieldOnValue, yetToReceive };
}

function applyNet(gross: number, wrapper: Wrapper, mode: "net" | "gross", locale: Locale): number {
  if (mode === "gross") return gross;
  const { net } = computeNetDividend({
    grossPrimaryCurrency: gross,
    wrapper,
    locale,
    ytdGrossInTaxableSoFar: 0,
  });
  return net;
}

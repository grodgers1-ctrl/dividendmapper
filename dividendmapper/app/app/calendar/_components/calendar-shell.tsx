"use client";

// Client wrapper owning the toggle + filter state for /app/calendar. Composes
// the chart, drill-down, KPI strip, wrapper filter, and optional empty-state
// CTA. KPIs recompute on filter / Net-Gross / Year-mode change in-memory.

import { useMemo, useState } from "react";
import type {
  IncomeCalendarResult,
  IncomeCalendarUserDividend,
  Locale,
  Wrapper,
  WrapperFilter,
} from "@/lib/portfolio/income-calendar";
import { computeNetDividend } from "@/lib/portfolio/dividend-tax";
import { HeroKpiStrip } from "./hero-kpi-strip";
import { WrapperFilterRow } from "./wrapper-filter-row";
import { CalendarChart } from "./calendar-chart";
import { DrilldownPanel } from "./drilldown-panel";
import { CadenceTimeline } from "./cadence-timeline";
import { EmptyStateCta } from "./empty-state-cta";

export interface CalendarShellProps {
  locale: Locale;
  calendar: IncomeCalendarResult;
  userDividends: ReadonlyArray<IncomeCalendarUserDividend>;
  ratesToPrimary: Record<string, number>;
  showEmptyStateCta: boolean;
}

export function CalendarShell({
  locale,
  calendar,
  userDividends,
  ratesToPrimary,
  showEmptyStateCta,
}: CalendarShellProps) {
  const [netMode, setNetMode] = useState<"net" | "gross">("net");
  const [yearMode, setYearMode] = useState<"tax" | "calendar">("tax");
  const [wrapperFilter, setWrapperFilter] = useState<WrapperFilter>("all");
  const [selectedYm, setSelectedYm] = useState<string>(() => {
    const partial = calendar.months.find((m) => m.kind === "partial");
    return partial?.ym ?? calendar.months[0]?.ym ?? "";
  });

  const kpis = useMemo(
    () =>
      computeKpis(
        calendar,
        wrapperFilter,
        netMode,
        locale,
        userDividends,
        ratesToPrimary,
        yearMode,
      ),
    [calendar, wrapperFilter, netMode, locale, userDividends, ratesToPrimary, yearMode],
  );

  const drilldownPayments = useMemo(
    () => buildDrilldownPayments(calendar, selectedYm, wrapperFilter),
    [calendar, selectedYm, wrapperFilter],
  );

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex items-center justify-end gap-3"
        data-testid="calendar-header-toggles"
      >
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
            { value: "tax", label: "Tax year" },
            { value: "calendar", label: "Calendar year" },
          ]}
          onChange={(v) => setYearMode(v as "tax" | "calendar")}
        />
      </div>
      <WrapperFilterRow locale={locale} value={wrapperFilter} onChange={setWrapperFilter} />
      {showEmptyStateCta && <EmptyStateCta />}
      <HeroKpiStrip
        primaryCurrency={calendar.primaryCurrency}
        next7Days={kpis.next7Days}
        next30Days={kpis.next30Days}
        ytdReceived={kpis.ytdReceived}
        last12mReceived={kpis.last12mReceived}
        includesProjected={calendar.months.some((m) =>
          m.segments.some(
            (s) =>
              s.kind === "projected-cadence" ||
              s.kind === "projected-growth" ||
              s.kind === "growth-clipped",
          ),
        )}
      />
      <CalendarChart
        months={calendar.months}
        onSelectMonth={setSelectedYm}
        selectedYm={selectedYm}
        primaryCurrency={calendar.primaryCurrency}
      />
      <DrilldownPanel
        primaryCurrency={calendar.primaryCurrency}
        payments={drilldownPayments}
        emptyReason={drilldownPayments.length === 0 ? "no-announcement" : undefined}
      />
      <CadenceTimeline
        monthYm={selectedYm}
        anchor="ex"
        today={new Date().toISOString().slice(0, 10)}
        markers={drilldownPayments
          .filter((p) => p.exDate.slice(0, 7) === selectedYm)
          .map((p) => ({ id: `${p.ticker}-${p.exDate}`, dayOfMonth: Number(p.exDate.slice(8, 10)) }))}
      />
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

function computeKpis(
  calendar: IncomeCalendarResult,
  filter: WrapperFilter,
  netMode: "net" | "gross",
  locale: Locale,
  userDividends: ReadonlyArray<IncomeCalendarUserDividend>,
  ratesToPrimary: Record<string, number>,
  yearMode: "tax" | "calendar",
): { next7Days: number; next30Days: number; ytdReceived: number; last12mReceived: number } {
  const apply = (gross: number, wrapper: Wrapper) => applyNet(gross, wrapper, netMode, locale);

  const next7Days = calendar.nextThree
    .filter((p) => filter === "all" || p.wrapper === filter)
    .filter((p) => withinDays(p.exDate, 7))
    .reduce((s, p) => s + apply(p.gbp, p.wrapper), 0);

  const next30Days = calendar.nextThree
    .filter((p) => filter === "all" || p.wrapper === filter)
    .filter((p) => withinDays(p.exDate, 30))
    .reduce((s, p) => s + apply(p.gbp, p.wrapper), 0);

  // YTD start: UK tax year starts Apr 6; US calendar year. yearMode='calendar'
  // forces Jan 1 regardless of locale.
  const now = new Date();
  let ytdStart: Date;
  if (yearMode === "calendar") {
    ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else if (locale === "uk") {
    const thisYearStart = new Date(Date.UTC(now.getUTCFullYear(), 3, 6));
    ytdStart = now >= thisYearStart ? thisYearStart : new Date(Date.UTC(now.getUTCFullYear() - 1, 3, 6));
  } else {
    ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  const ytdStartIso = ytdStart.toISOString().slice(0, 10);
  const twelveMoAgoIso = new Date(now.getTime() - 365 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const ytd = userDividends
    .filter((d) => filter === "all" || d.wrapper === filter)
    .filter((d) => d.paid_on >= ytdStartIso)
    .reduce((s, d) => s + apply((d.amount * (ratesToPrimary[d.currency] ?? 0)), d.wrapper), 0);

  const last12m = userDividends
    .filter((d) => filter === "all" || d.wrapper === filter)
    .filter((d) => d.paid_on >= twelveMoAgoIso)
    .reduce((s, d) => s + apply((d.amount * (ratesToPrimary[d.currency] ?? 0)), d.wrapper), 0);

  return { next7Days, next30Days, ytdReceived: ytd, last12mReceived: last12m };
}

function withinDays(iso: string, days: number): boolean {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return target - now <= days * 86_400_000 && target >= now;
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

function buildDrilldownPayments(
  calendar: IncomeCalendarResult,
  selectedYm: string,
  filter: WrapperFilter,
) {
  // Slice A drill-down sources from nextThree filtered to the selected
  // month. Slice B replaces this with a richer per-month list assembled
  // from segments.
  return calendar.nextThree
    .filter((p) => p.exDate.slice(0, 7) === selectedYm)
    .filter((p) => filter === "all" || p.wrapper === filter)
    .map((p) => ({
      ticker: p.ticker,
      exDate: p.exDate,
      payDate: p.payDate,
      // DrilldownPanel renders nativeAmount as the per-share figure, e.g.
      // "1.98 GBp" alongside the total primary "× 50 = £0.99".
      nativeAmount: p.perShareNative,
      nativeCurrency: p.nativeCurrency,
      quantity: p.quantity,
      primaryAmount: p.gbp,
      wrapper: p.wrapper,
      confidence: "confirmed" as const,
    }));
}

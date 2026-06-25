"use client";

// Vertical KPI sidebar for /app/calendar. Annual income is the headline (with
// a brand-gradient text fill); Monthly, Daily, Yield, and "Yet to receive"
// stack below as smaller stats. Replaces the 4-card HeroKpiStrip so the chart
// gets the full right-column real estate.

const NUMBER_FMT_GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});
const NUMBER_FMT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatPrimary(n: number, currency: "GBP" | "USD"): string {
  const fmt = currency === "USD" ? NUMBER_FMT_USD : NUMBER_FMT_GBP;
  return fmt.format(n);
}

function formatPrimaryRounded(n: number, currency: "GBP" | "USD"): string {
  const fmt = new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return fmt.format(Math.round(n));
}

export interface StatSidebarProps {
  primaryCurrency: "GBP" | "USD";
  /** Sum of all expected payments in the next 12 months (confirmed + projected). */
  annualIncome: number;
  /** Annual income ÷ 12. */
  monthlyAverage: number;
  /** Annual income ÷ 365. */
  dailyAverage: number;
  /** Annual income ÷ portfolio value, as a decimal (0.0338 = 3.38%). null when value is unknown. */
  yieldOnValue: number | null;
  /** Sum of the remaining expected payments before the next year-end (or tax-year-end). */
  yetToReceive: number;
  /** When true, surface the cadence-based caveat under Annual income. */
  includesProjected: boolean;
  /** Distinct ticker count whose forward contributions are zero (no projection
   * cache, no FMP forward DPS). Rendered as a caveat under the Annual income
   * figure to keep the number honest. Omit or set 0 to hide. */
  unprojectedCount?: number;
}

export function StatSidebar(props: StatSidebarProps) {
  const {
    primaryCurrency,
    annualIncome,
    monthlyAverage,
    dailyAverage,
    yieldOnValue,
    yetToReceive,
    includesProjected,
    unprojectedCount,
  } = props;

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Monthly", value: formatPrimary(monthlyAverage, primaryCurrency) },
    { label: "Daily", value: formatPrimary(dailyAverage, primaryCurrency) },
    {
      label: "Yield",
      value:
        yieldOnValue === null
          ? "—"
          : `${(yieldOnValue * 100).toFixed(2)}%`,
    },
    { label: "Yet to receive", value: formatPrimaryRounded(yetToReceive, primaryCurrency) },
  ];

  return (
    <aside
      data-testid="calendar-stat-sidebar"
      className="card-surface flex flex-col gap-4 p-5"
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Annual income
        </p>
        <p
          data-testid="calendar-stat-annual"
          className="mt-1 font-mono text-3xl font-semibold tabular-nums bg-gradient-to-br from-[var(--brand)] to-[color-mix(in_oklab,var(--brand)_55%,#0a1a13)] bg-clip-text text-transparent"
        >
          {formatPrimaryRounded(annualIncome, primaryCurrency)}
        </p>
        {includesProjected && (
          <p
            data-testid="calendar-stat-incl-projected"
            className="mt-1 text-[10px] text-[var(--text-muted)]"
          >
            incl. projected
          </p>
        )}
        {typeof unprojectedCount === "number" && unprojectedCount > 0 && (
          <p
            data-testid="calendar-stat-unprojected"
            className="mt-1 text-[10px] text-[var(--text-muted)]"
          >
            {unprojectedCount === 1
              ? "1 holding not yet projected"
              : `${unprojectedCount} holdings not yet projected`}
          </p>
        )}
      </div>
      <dl className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between py-2">
            <dt className="text-xs text-[var(--text-muted)]">{r.label}</dt>
            <dd className="font-mono text-sm tabular-nums text-[var(--text)]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

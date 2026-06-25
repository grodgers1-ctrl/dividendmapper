// Four-tile KPI strip at the top of /app/calendar. Locale-aware primary
// currency. The `(incl. projected)` footnote renders only when the parent
// signals that any tile sum includes projected payments (Slice B turns this
// on; Slice A always passes false).

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

function formatPrimary(n: number, currency: "GBP" | "USD"): string {
  const fmt = currency === "USD" ? NUMBER_FMT_USD : NUMBER_FMT_GBP;
  return fmt.format(Math.round(n));
}

export interface HeroKpiStripProps {
  primaryCurrency: "GBP" | "USD";
  next7Days: number;
  next30Days: number;
  ytdReceived: number;
  last12mReceived: number;
  includesProjected: boolean;
}

export function HeroKpiStrip(props: HeroKpiStripProps) {
  const {
    primaryCurrency,
    next7Days,
    next30Days,
    ytdReceived,
    last12mReceived,
    includesProjected,
  } = props;

  const tiles: ReadonlyArray<{ key: string; label: string; value: number }> = [
    { key: "next7", label: "Next 7 days", value: next7Days },
    { key: "next30", label: "Next 30 days", value: next30Days },
    { key: "ytd", label: "YTD received", value: ytdReceived },
    { key: "last12", label: "Last 12 months received", value: last12mReceived },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.key}
            aria-label={t.label}
            className="card-surface flex flex-col gap-1 p-4"
          >
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t.label}
            </span>
            <span className="font-mono text-2xl tabular-nums text-[var(--text)]">
              {formatPrimary(t.value, primaryCurrency)}
            </span>
          </div>
        ))}
      </div>
      {includesProjected && (
        <p className="mt-2 text-[10px] text-[var(--text-muted)]">
          (incl. projected)
        </p>
      )}
    </div>
  );
}

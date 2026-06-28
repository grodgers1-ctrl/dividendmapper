// Snapshot strip for the Inspect ticker page. Six tiles: PE, Yield, FCF Payout,
// Net Debt/EBITDA, DGR 5y, ROIC. Each tile shows the current value plus a
// percentile chip coloured by goodness (greener if the metric is in a "good"
// zone for its goodDirection, rosier in a "bad" zone, amber in the middle).
//
// Server component. No interactivity yet; Day 6 may swap to a sparkline tile.

type Format = "multiple" | "pct" | "ratio";
type Direction = "high" | "low";

type Tile = {
  key: string;
  label: string;
  value: number | null;
  format: Format;
  percentile: number | null;
  goodDirection: Direction;
};

type Props = {
  current: Record<string, number | null>;
  percentiles: Record<string, number | null>;
};

function formatValue(value: number | null, format: Format): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (format === "multiple") return `${value.toFixed(1)}×`;
  if (format === "pct") return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

// Map a 0-1 percentile + direction onto a small palette of Tailwind classes.
// goodDirection 'high' rewards a percentile near 1; 'low' inverts it.
function chipClasses(percentile: number | null, direction: Direction): string {
  if (percentile == null || !Number.isFinite(percentile)) return "";
  const good = direction === "high" ? percentile : 1 - percentile;
  if (good >= 0.7) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (good <= 0.3) {
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

export function InspectSnapshotStrip({ current, percentiles }: Props) {
  const tiles: Tile[] = [
    { key: "pe", label: "P/E", value: current.pe, format: "multiple", percentile: percentiles.pe, goodDirection: "low" },
    { key: "dividend_yield", label: "Yield", value: current.dividend_yield, format: "pct", percentile: percentiles.dividend_yield, goodDirection: "high" },
    { key: "fcf_payout", label: "FCF payout", value: current.fcf_payout, format: "pct", percentile: percentiles.fcf_payout, goodDirection: "low" },
    { key: "net_debt_ebitda", label: "Net debt / EBITDA", value: current.net_debt_ebitda, format: "ratio", percentile: percentiles.net_debt_ebitda, goodDirection: "low" },
    { key: "dgr_5y", label: "DGR 5y", value: current.dgr_5y, format: "pct", percentile: percentiles.dgr_5y, goodDirection: "high" },
    { key: "roic", label: "ROIC", value: current.roic, format: "pct", percentile: percentiles.roic, goodDirection: "high" },
  ];

  return (
    <section aria-label="Snapshot" className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Snapshot
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {tile.label}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
              {formatValue(tile.value, tile.format)}
            </p>
            {tile.percentile != null && Number.isFinite(tile.percentile) && (
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${chipClasses(
                  tile.percentile,
                  tile.goodDirection,
                )}`}
              >
                P{Math.round(tile.percentile * 100)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

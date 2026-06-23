// Read-side rollup for the RidgeSparkline on the dashboard. Walks the raw
// portfolio_income_history rows (one per (snapshot_at, currency)), FX-converts
// to GBP using the supplied ratesToGbp map, and returns one point per date —
// sorted ascending — for the sparkline to plot.

export interface IncomeHistoryRow {
  snapshot_at: string;
  currency: string;
  total_annual_run_rate: number;
}

export interface IncomeHistoryPoint {
  at: Date;
  value: number;
}

export function rollupIncomeHistoryToGbp(
  rows: ReadonlyArray<IncomeHistoryRow>,
  ratesToGbp: Readonly<Record<string, number>>,
): IncomeHistoryPoint[] {
  if (rows.length === 0) return [];

  const totalsByDate = new Map<string, number>();
  for (const row of rows) {
    const rate = ratesToGbp[row.currency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
    const contribution = Number(row.total_annual_run_rate) * rate;
    if (!Number.isFinite(contribution)) continue;
    totalsByDate.set(
      row.snapshot_at,
      (totalsByDate.get(row.snapshot_at) ?? 0) + contribution,
    );
  }

  return Array.from(totalsByDate.entries())
    .map(([snapshot_at, value]) => ({
      at: new Date(`${snapshot_at}T00:00:00Z`),
      value,
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

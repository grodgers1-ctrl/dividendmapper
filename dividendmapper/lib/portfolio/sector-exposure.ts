// Sector-weight rollup for the dashboard's SectorExposureCard. Takes the
// already-computed ticker weights from PortfolioAnalytics + the per-ticker
// sector classifications from equity_scores.sector and bins them into
// top-N + Other. Null/empty sectors bucket into "Unclassified" so a missing
// FMP profile doesn't silently drop weight off the chart.
//
// max is `top[0]` after sorting — used by the card's overweight pill so it
// doesn't have to rescan.

export interface SectorSlice {
  sector: string;
  weight: number;
}

export interface SectorRollup {
  top: SectorSlice[];
  other: SectorSlice | null;
  max: SectorSlice | null;
}

const UNCLASSIFIED = "Unclassified";

function normaliseSector(value: string | null | undefined): string {
  if (typeof value !== "string") return UNCLASSIFIED;
  const trimmed = value.trim();
  return trimmed === "" ? UNCLASSIFIED : trimmed;
}

export function rollupSectors(args: {
  weightByTicker: Record<string, number>;
  sectorByTicker: Record<string, string | null>;
  topN?: number;
}): SectorRollup {
  const { weightByTicker, sectorByTicker, topN = 3 } = args;

  const totals = new Map<string, number>();
  for (const [ticker, weight] of Object.entries(weightByTicker)) {
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const sector = normaliseSector(sectorByTicker[ticker]);
    totals.set(sector, (totals.get(sector) ?? 0) + weight);
  }

  const sorted: SectorSlice[] = Array.from(totals.entries())
    .map(([sector, weight]) => ({ sector, weight }))
    .sort((a, b) => b.weight - a.weight);

  if (sorted.length === 0) {
    return { top: [], other: null, max: null };
  }

  if (sorted.length <= topN) {
    return { top: sorted, other: null, max: sorted[0] };
  }

  const top = sorted.slice(0, topN);
  const tail = sorted.slice(topN);
  const otherWeight = tail.reduce((acc, s) => acc + s.weight, 0);
  const other: SectorSlice = { sector: "Other", weight: otherWeight };
  return { top, other, max: top[0] };
}

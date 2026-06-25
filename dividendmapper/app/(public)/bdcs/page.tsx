import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  listVehicleTickers,
  type VehicleListSort,
} from "@/lib/scoring/list-vehicle-tickers";
import { fetchLatestYieldsForTickers } from "@/lib/scoring/fetch-latest-yields";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";
import { ListFilters } from "../_components/list-filters";

export const revalidate = 3600;

const family = VEHICLE_FAMILIES.us_bdc;

export const metadata: Metadata = {
  title: "US BDCs ranked by dividend resilience and yield",
  description:
    "Every US Business Development Company in coverage with a 0-100 dividend Resilience score and TTM yield. Informational, not financial advice.",
  alternates: { canonical: "/bdcs" },
  openGraph: {
    title: "US BDCs ranked by dividend resilience and yield | DividendMapper",
    description: family.indexCopy,
    url: `${SITE_URL}/bdcs`,
  },
};

type BdcSort = VehicleListSort | "yield-desc" | "yield-asc";

const SORT_OPTIONS: { value: BdcSort; label: string }[] = [
  { value: "yield-desc", label: "TTM yield (high to low)" },
  { value: "yield-asc", label: "TTM yield (low to high)" },
  { value: "resilience-desc", label: "Resilience (high to low)" },
  { value: "resilience-asc", label: "Resilience (low to high)" },
  { value: "alpha", label: "Ticker A-Z" },
];

function isBdcSort(v: string | undefined): v is BdcSort {
  return (
    v === "yield-desc" ||
    v === "yield-asc" ||
    v === "resilience-desc" ||
    v === "resilience-asc" ||
    v === "alpha"
  );
}

function humanizeSubSector(sub: string): string {
  return sub.replace(/_/g, " ");
}

function formatYieldPct(y: number | null): string {
  if (y === null) return "—";
  // equity_score_history.current_yield is stored as a decimal (e.g. 0.0852).
  return `${(y * 100).toFixed(1)}%`;
}

export default async function BdcsListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; sub?: string }>;
}) {
  const sp = await searchParams;
  const sort: BdcSort = isBdcSort(sp.sort) ? sp.sort : "yield-desc";
  const subSector = sp.sub || undefined;

  const supabase = createSupabasePublicClient();

  // listVehicleTickers stays family-agnostic — the yield-desc/asc sort is a
  // BDC-only concern, so it's applied at the page level after we enrich rows
  // with the latest equity_score_history yield.
  const baseSort: VehicleListSort =
    sort === "yield-desc" || sort === "yield-asc" ? "resilience-desc" : sort;
  const baseRows = await listVehicleTickers({
    supabase,
    vehicleType: family.vehicleType,
    sort: baseSort,
    subSector,
  });
  const yields = await fetchLatestYieldsForTickers(
    supabase,
    baseRows.map((r) => r.ticker),
  );
  const rows = baseRows.map((r) => ({
    ...r,
    currentYield: yields.get(r.ticker) ?? null,
  }));
  if (sort === "yield-desc" || sort === "yield-asc") {
    rows.sort((a, b) => {
      const av = a.currentYield;
      const bv = b.currentYield;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sort === "yield-desc" ? bv - av : av - bv;
    });
  }

  const subSectorValues = Array.from(
    new Set(
      rows
        .map((r) => r.subSector)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort();
  const subSectorOptions = subSectorValues.map((s) => ({
    value: s,
    label: humanizeSubSector(s),
  }));

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
          <Link
            href="/income-vehicles"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden>←</span>
            Income vehicles
          </Link>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {family.heading}
        </h1>
        <p className="mt-3 max-w-prose text-base text-foreground">{family.indexCopy}</p>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          The Resilience score (0–100) emphasises NII coverage and statutory leverage —
          the two biggest drivers of BDC dividend cuts. Informational only, not a
          recommendation.{" "}
          <Link
            href="/methodology/income-vehicles#us-bdcs"
            className="underline underline-offset-2 hover:text-foreground"
          >
            How this score is calculated
          </Link>
          .
        </p>

        <div className="mt-8">
          <ListFilters
            sortOptions={SORT_OPTIONS}
            defaultSort="yield-desc"
            subSectors={subSectorOptions}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Ticker
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Name
                </th>
                <th scope="col" className="hidden px-4 py-3 text-left font-semibold sm:table-cell">
                  Sub-sector
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-semibold sm:table-cell">
                  TTM yield
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Resilience
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/bdcs/${r.ticker}`}
                      className="font-mono font-semibold text-foreground hover:underline"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.displayName}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {r.subSector ? humanizeSubSector(r.subSector) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-foreground sm:table-cell">
                    {formatYieldPct(r.currentYield)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                    {r.resilienceScore ?? (
                      <span title="Quality gate failed" className="text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Yields are TTM (trailing twelve months) and update with the daily price snapshot.
          A BDC not listed here may not be in the V1 universe yet.
        </p>

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Scores and yields are informational and refresh daily. They are not financial
          advice, not a prediction of future returns, and not instructions to buy or sell.
          Always do your own research. See the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

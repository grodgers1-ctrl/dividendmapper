import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  listVehicleTickers,
  type VehicleListSort,
} from "@/lib/scoring/list-vehicle-tickers";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";
import { ListFilters } from "../_components/list-filters";

export const revalidate = 3600;

const family = VEHICLE_FAMILIES.us_reit;

export const metadata: Metadata = {
  title: "US REITs ranked by dividend resilience",
  description:
    "Every US REIT in coverage with a 0-100 dividend Resilience score. Informational, not financial advice.",
  alternates: { canonical: "/reits" },
  openGraph: {
    title: "US REITs ranked by dividend resilience | DividendMapper",
    description: family.indexCopy,
    url: `${SITE_URL}/reits`,
  },
};

const SORT_OPTIONS: { value: VehicleListSort; label: string }[] = [
  { value: "resilience-desc", label: "Resilience (high to low)" },
  { value: "resilience-asc", label: "Resilience (low to high)" },
  { value: "alpha", label: "Ticker A-Z" },
];

function isSort(v: string | undefined): v is VehicleListSort {
  return v === "resilience-desc" || v === "resilience-asc" || v === "alpha";
}

function humanizeSubSector(sub: string): string {
  return sub.replace(/_/g, " ");
}

export default async function ReitsListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; sub?: string }>;
}) {
  const sp = await searchParams;
  const sort: VehicleListSort = isSort(sp.sort) ? sp.sort : "resilience-desc";
  const subSector = sp.sub || undefined;

  const supabase = createSupabasePublicClient();
  const rows = await listVehicleTickers({
    supabase,
    vehicleType: family.vehicleType,
    sort,
    subSector,
  });

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
          The Resilience score (0–100) is a composite across Quality, Discount, Concentration,
          and Risk. Informational only, not a recommendation.{" "}
          <Link
            href="/methodology/income-vehicles#us-reits"
            className="underline underline-offset-2 hover:text-foreground"
          >
            How this score is calculated
          </Link>
          .
        </p>

        <div className="mt-8">
          <ListFilters
            sortOptions={SORT_OPTIONS}
            defaultSort="resilience-desc"
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
                      href={`/reits/${r.ticker}`}
                      className="font-mono font-semibold text-foreground hover:underline"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.displayName}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {r.subSector ? humanizeSubSector(r.subSector) : "—"}
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
          Coverage is expanding. A REIT not listed here may not be in the V1 universe yet.
        </p>

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Scores are informational and refresh daily. They are not financial advice, not a
          prediction of future returns, and not instructions to buy or sell. Always do your own
          research. See the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

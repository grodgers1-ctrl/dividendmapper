import Link from "next/link";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";

const FAMILY_HEADING: Record<VehicleType, string> = {
  us_reit: "Top US REITs",
  us_bdc: "Top US BDCs",
  uk_reit: "Top UK REITs",
};

function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

export interface LeaderboardCardProps {
  vehicleType: VehicleType;
  universe: ReadonlyArray<VehicleUniverseRow>;
  topN: number;
}

export function LeaderboardCard({
  vehicleType,
  universe,
  topN,
}: LeaderboardCardProps) {
  const slug = VEHICLE_FAMILIES[vehicleType].slug;
  const rows = universe
    .filter(
      (r) =>
        r.vehicleType === vehicleType &&
        r.qualityGatePassed &&
        r.resilienceScore !== null,
    )
    .sort(
      (a, b) =>
        (b.resilienceScore as number) - (a.resilienceScore as number),
    )
    .slice(0, topN);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-sm font-semibold text-foreground">
        {FAMILY_HEADING[vehicleType]}
      </h3>
      <ol className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.ticker}>
            <Link
              href={`/${slug}/${r.ticker}`}
              className="group flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono font-medium text-foreground group-hover:underline">
                  {r.ticker}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  · {r.displayName}
                </span>
              </span>
              <span
                className="font-mono text-xs font-bold tabular-nums"
                style={{ color: rampColor(r.resilienceScore as number) }}
              >
                {r.resilienceScore}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

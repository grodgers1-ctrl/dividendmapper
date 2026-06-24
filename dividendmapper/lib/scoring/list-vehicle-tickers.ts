import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleType } from "./load-vehicle-score";

// Helper for the family list pages (/reits, /bdcs, /uk-reits). Reads
// vehicle_universe joined to vehicle_scores so a single query yields the
// display rows. Sort + sub-sector filter are applied in memory: the universe
// is ~100 rows, so the cost is trivial and the database does the easy work.

export type VehicleListSort = "resilience-desc" | "resilience-asc" | "alpha";

export interface VehicleListRow {
  ticker: string;
  displayName: string;
  subSector: string | null;
  resilienceScore: number | null;
}

interface UniverseJoinRow {
  ticker: string;
  display_name: string;
  sub_sector: string | null;
  vehicle_scores: { resilience_score: number | null } | null;
}

interface Args {
  supabase: SupabaseClient;
  vehicleType: VehicleType;
  sort: VehicleListSort;
  subSector?: string;
}

export async function listVehicleTickers({
  supabase,
  vehicleType,
  sort,
  subSector,
}: Args): Promise<VehicleListRow[]> {
  const builder = supabase
    .from("vehicle_universe")
    .select(
      "ticker, display_name, sub_sector, vehicle_scores(resilience_score)",
    )
    .eq("vehicle_type", vehicleType)
    .eq("included_in_v1", true)
    .eq("status", "active");
  const { data, error } = (await builder) as unknown as {
    data: UniverseJoinRow[] | null;
    error: unknown;
  };
  if (error) throw new Error("vehicle_universe_lookup_failed");
  const rows: VehicleListRow[] = (data ?? []).map((r) => ({
    ticker: r.ticker,
    displayName: r.display_name,
    subSector: r.sub_sector,
    resilienceScore: r.vehicle_scores?.resilience_score ?? null,
  }));

  const filtered = subSector
    ? rows.filter((r) => r.subSector === subSector)
    : rows;

  return sortRows(filtered, sort);
}

function sortRows(rows: VehicleListRow[], sort: VehicleListSort): VehicleListRow[] {
  const copy = [...rows];
  switch (sort) {
    case "alpha":
      copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
      return copy;
    case "resilience-asc":
      copy.sort((a, b) => withNullsLast(a.resilienceScore, b.resilienceScore, "asc"));
      return copy;
    case "resilience-desc":
    default:
      copy.sort((a, b) => withNullsLast(a.resilienceScore, b.resilienceScore, "desc"));
      return copy;
  }
}

function withNullsLast(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

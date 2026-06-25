import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleType } from "./load-vehicle-score";

// Server-side loader for the /income-vehicles hub. Returns the entire scored
// universe (~100 rows) in one round-trip, joined to vehicle_universe for the
// display name + sub-sector. Embedded directly in the page payload so the
// client-side filter and search run with no network round-trips.

export interface VehicleUniverseRow {
  ticker: string;
  vehicleType: VehicleType;
  displayName: string;
  subSector: string | null;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  dividendYield: number | null;
  leverageHeadline: string;
  computedAt: string;
}

type ScoreRowDb = {
  ticker: string;
  vehicle_type: VehicleType;
  resilience_score: number | null;
  quality_gate_passed: boolean;
  computed_at: string;
};

type UniverseRowDb = {
  ticker: string;
  display_name: string;
  sub_sector: string | null;
  dividend_yield: number | null;
  leverage_headline: string | null;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadVehicleUniverse(
  client: SupabaseClient,
): Promise<VehicleUniverseRow[]> {
  const { data: scoresRaw, error: scoresError } = await client
    .from("vehicle_scores")
    .select("ticker, vehicle_type, resilience_score, quality_gate_passed, computed_at");
  if (scoresError) throw new Error("vehicle_universe_lookup_failed");
  const scores = (scoresRaw ?? []) as ScoreRowDb[];
  if (scores.length === 0) return [];

  const { data: universeRaw } = await client
    .from("vehicle_universe")
    .select("ticker, display_name, sub_sector, dividend_yield, leverage_headline");
  const universeByTicker = new Map<string, UniverseRowDb>();
  for (const row of (universeRaw ?? []) as UniverseRowDb[]) {
    universeByTicker.set(row.ticker, row);
  }

  return scores.map((s) => {
    const u = universeByTicker.get(s.ticker);
    return {
      ticker: s.ticker,
      vehicleType: s.vehicle_type,
      displayName: u?.display_name ?? s.ticker,
      subSector: u?.sub_sector ?? null,
      resilienceScore: toNumber(s.resilience_score),
      qualityGatePassed: s.quality_gate_passed,
      dividendYield: toNumber(u?.dividend_yield ?? null),
      leverageHeadline: u?.leverage_headline ?? "",
      computedAt: s.computed_at,
    };
  });
}

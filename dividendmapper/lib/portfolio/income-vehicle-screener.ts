import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";

// Pure filter / search / sort helpers for the /income-vehicles hub. The hub
// embeds the full scored universe (~100 rows) in the page payload; these
// functions transform that array in memory on each keystroke or filter change.
// No I/O — keeps the screener instant and the unit tests fast.

export type FamilyChoice = "all" | VehicleType;

export interface ScreenerCriteria {
  family: FamilyChoice;
  minResilience: number; // 0..100; rows below this are dropped (gate-failed scores=null are always dropped here too)
  subSector: string | null;
  gatePassedOnly: boolean;
}

export function filterVehicles(
  rows: ReadonlyArray<VehicleUniverseRow>,
  criteria: ScreenerCriteria,
): VehicleUniverseRow[] {
  return rows.filter((r) => {
    if (criteria.family !== "all" && r.vehicleType !== criteria.family) {
      return false;
    }
    if (criteria.gatePassedOnly && !r.qualityGatePassed) return false;
    if (criteria.subSector !== null && r.subSector !== criteria.subSector) {
      return false;
    }
    if (criteria.minResilience > 0) {
      if (r.resilienceScore === null) return false;
      if (r.resilienceScore < criteria.minResilience) return false;
    }
    return true;
  });
}

// Exact ticker hit ranks first, then prefix-on-ticker, then substring-on-name.
// Empty / whitespace query short-circuits and returns the universe unchanged.
export function searchVehicles(
  rows: ReadonlyArray<VehicleUniverseRow>,
  query: string,
): VehicleUniverseRow[] {
  const q = query.trim().toUpperCase();
  if (q.length === 0) return rows.slice();
  const exact: VehicleUniverseRow[] = [];
  const prefix: VehicleUniverseRow[] = [];
  const substring: VehicleUniverseRow[] = [];
  for (const r of rows) {
    const ticker = r.ticker.toUpperCase();
    const name = r.displayName.toUpperCase();
    if (ticker === q) {
      exact.push(r);
    } else if (ticker.startsWith(q)) {
      prefix.push(r);
    } else if (ticker.includes(q) || name.includes(q)) {
      substring.push(r);
    }
  }
  return [...exact, ...prefix, ...substring];
}

export type SortKey = "resilience" | "ticker" | "yield";
export type SortDir = "asc" | "desc";

export function sortVehicles(
  rows: ReadonlyArray<VehicleUniverseRow>,
  key: SortKey,
  dir: SortDir,
): VehicleUniverseRow[] {
  const out = rows.slice();
  out.sort((a, b) => {
    // Null handling is direction-independent — nulls always rank last,
    // regardless of asc/desc, so they don't flip with the sign.
    if (key === "resilience") {
      const aNull = a.resilienceScore === null;
      const bNull = b.resilienceScore === null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
    } else if (key === "yield") {
      const aNull = a.dividendYield === null;
      const bNull = b.dividendYield === null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
    }
    const cmp = compareBy(a, b, key);
    return dir === "asc" ? cmp : -cmp;
  });
  return out;
}

function compareBy(
  a: VehicleUniverseRow,
  b: VehicleUniverseRow,
  key: SortKey,
): number {
  if (key === "ticker") return a.ticker.localeCompare(b.ticker);
  if (key === "resilience") {
    return (a.resilienceScore as number) - (b.resilienceScore as number);
  }
  // yield
  return (a.dividendYield as number) - (b.dividendYield as number);
}

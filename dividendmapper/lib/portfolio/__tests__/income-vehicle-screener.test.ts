import { describe, it, expect } from "vitest";
import {
  filterVehicles,
  searchVehicles,
  sortVehicles,
  type ScreenerCriteria,
} from "../income-vehicle-screener";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

function row(overrides: Partial<VehicleUniverseRow> = {}): VehicleUniverseRow {
  return {
    ticker: "O",
    vehicleType: "us_reit",
    displayName: "Realty Income",
    subSector: "retail_net_lease",
    resilienceScore: 80,
    qualityGatePassed: true,
    dividendYield: 0.056,
    leverageHeadline: "FFO payout 81%",
    computedAt: "2026-06-23T09:00:00Z",
    ...overrides,
  };
}

const UNIVERSE: VehicleUniverseRow[] = [
  row({ ticker: "O", vehicleType: "us_reit", resilienceScore: 80 }),
  row({ ticker: "PSA", vehicleType: "us_reit", displayName: "Public Storage", resilienceScore: 78 }),
  row({ ticker: "MAIN", vehicleType: "us_bdc", displayName: "Main Street Capital", subSector: "internally_managed_bdc", resilienceScore: 73 }),
  row({ ticker: "BLND.L", vehicleType: "uk_reit", displayName: "British Land", subSector: "uk_diversified", resilienceScore: 65 }),
  row({ ticker: "BAD", vehicleType: "us_reit", resilienceScore: null, qualityGatePassed: false }),
];

const EMPTY_CRITERIA: ScreenerCriteria = {
  family: "all",
  minResilience: 0,
  subSector: null,
  gatePassedOnly: false,
};

describe("filterVehicles", () => {
  it("returns the full universe when no filters are active", () => {
    expect(filterVehicles(UNIVERSE, EMPTY_CRITERIA)).toHaveLength(5);
  });

  it("filters by family chip", () => {
    const out = filterVehicles(UNIVERSE, { ...EMPTY_CRITERIA, family: "us_bdc" });
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("MAIN");
  });

  it("filters by min resilience (gate-failed rows have null score and are dropped)", () => {
    const out = filterVehicles(UNIVERSE, { ...EMPTY_CRITERIA, minResilience: 75 });
    expect(out.map((r) => r.ticker).sort()).toEqual(["O", "PSA"]);
  });

  it("filters by sub-sector", () => {
    const out = filterVehicles(UNIVERSE, {
      ...EMPTY_CRITERIA,
      subSector: "uk_diversified",
    });
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("BLND.L");
  });

  it("gate-passed-only excludes failed-gate vehicles", () => {
    const out = filterVehicles(UNIVERSE, {
      ...EMPTY_CRITERIA,
      gatePassedOnly: true,
    });
    expect(out.every((r) => r.qualityGatePassed)).toBe(true);
    expect(out.find((r) => r.ticker === "BAD")).toBeUndefined();
  });

  it("combined filters with no matches return empty", () => {
    const out = filterVehicles(UNIVERSE, {
      family: "uk_reit",
      minResilience: 90,
      subSector: null,
      gatePassedOnly: false,
    });
    expect(out).toEqual([]);
  });
});

describe("searchVehicles", () => {
  it("exact ticker hit ranks first", () => {
    const out = searchVehicles(UNIVERSE, "MAIN");
    expect(out[0].ticker).toBe("MAIN");
  });

  it("matches a substring on displayName, case-insensitive", () => {
    const out = searchVehicles(UNIVERSE, "british");
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("BLND.L");
  });

  it("matches a prefix on ticker", () => {
    const out = searchVehicles(UNIVERSE, "ps");
    expect(out[0].ticker).toBe("PSA");
  });

  it("no match returns empty", () => {
    expect(searchVehicles(UNIVERSE, "zzz")).toEqual([]);
  });

  it("empty query returns the full universe unchanged", () => {
    expect(searchVehicles(UNIVERSE, "")).toEqual(UNIVERSE);
    expect(searchVehicles(UNIVERSE, "   ")).toEqual(UNIVERSE);
  });
});

describe("sortVehicles", () => {
  it("sorts by resilience desc by default (gate-failed at the bottom)", () => {
    const out = sortVehicles(UNIVERSE, "resilience", "desc");
    expect(out.map((r) => r.ticker)).toEqual(["O", "PSA", "MAIN", "BLND.L", "BAD"]);
  });

  it("sorts by ticker asc", () => {
    const out = sortVehicles(UNIVERSE, "ticker", "asc");
    expect(out.map((r) => r.ticker)).toEqual([
      "BAD",
      "BLND.L",
      "MAIN",
      "O",
      "PSA",
    ]);
  });

  it("sorts by yield desc, null yields fall to the bottom", () => {
    const universeWithNullYield = [
      ...UNIVERSE.slice(0, 2),
      row({
        ticker: "NOFEED",
        vehicleType: "us_reit",
        dividendYield: null,
      }),
    ];
    const out = sortVehicles(universeWithNullYield, "yield", "desc");
    expect(out[out.length - 1].ticker).toBe("NOFEED");
  });
});

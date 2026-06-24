import { describe, it, expect, vi } from "vitest";
import { listVehicleTickers } from "../list-vehicle-tickers";

type Row = Record<string, unknown>;

function makeStubSb(rows: Row[]) {
  const builder = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then(resolve: (v: { data: Row[]; error: unknown }) => void) {
      resolve({ data: rows, error: null });
    },
  };
  const select = vi.fn(() => builder);
  const from = vi.fn(() => ({ select }));
  return { sb: { from }, select, builder, from };
}

const UNIVERSE_ROWS_US_REIT = [
  {
    ticker: "O",
    display_name: "Realty Income",
    sub_sector: "retail_net_lease",
    vehicle_scores: { resilience_score: 72 },
  },
  {
    ticker: "SPG",
    display_name: "Simon Property",
    sub_sector: "retail_mall",
    vehicle_scores: { resilience_score: 58 },
  },
  {
    ticker: "AMT",
    display_name: "American Tower",
    sub_sector: "tower",
    vehicle_scores: { resilience_score: null },
  },
  {
    ticker: "VICI",
    display_name: "VICI Properties",
    sub_sector: "retail_net_lease",
    vehicle_scores: { resilience_score: 85 },
  },
];

describe("listVehicleTickers", () => {
  it("sorts by resilience descending; nulls last", async () => {
    const { sb } = makeStubSb(UNIVERSE_ROWS_US_REIT);
    const rows = await listVehicleTickers({
      supabase: sb,
      vehicleType: "us_reit",
      sort: "resilience-desc",
    });
    expect(rows.map((r) => r.ticker)).toEqual(["VICI", "O", "SPG", "AMT"]);
    expect(rows[0].resilienceScore).toBe(85);
    expect(rows.at(-1)!.resilienceScore).toBeNull();
  });

  it("sorts by resilience ascending; nulls last", async () => {
    const { sb } = makeStubSb(UNIVERSE_ROWS_US_REIT);
    const rows = await listVehicleTickers({
      supabase: sb,
      vehicleType: "us_reit",
      sort: "resilience-asc",
    });
    expect(rows.map((r) => r.ticker)).toEqual(["SPG", "O", "VICI", "AMT"]);
  });

  it("sorts alphabetically by ticker", async () => {
    const { sb } = makeStubSb(UNIVERSE_ROWS_US_REIT);
    const rows = await listVehicleTickers({
      supabase: sb,
      vehicleType: "us_reit",
      sort: "alpha",
    });
    expect(rows.map((r) => r.ticker)).toEqual(["AMT", "O", "SPG", "VICI"]);
  });

  it("filters by sub-sector", async () => {
    const { sb } = makeStubSb(UNIVERSE_ROWS_US_REIT);
    const rows = await listVehicleTickers({
      supabase: sb,
      vehicleType: "us_reit",
      sort: "resilience-desc",
      subSector: "retail_net_lease",
    });
    expect(rows.map((r) => r.ticker)).toEqual(["VICI", "O"]);
  });
});

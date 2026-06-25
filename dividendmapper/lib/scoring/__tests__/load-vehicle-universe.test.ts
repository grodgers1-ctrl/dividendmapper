import { describe, it, expect, vi } from "vitest";
import { loadVehicleUniverse } from "../load-vehicle-universe";

type Row = Record<string, unknown>;

function makeStub(rows: { vehicle_scores?: Row[]; vehicle_universe?: Row[] }) {
  const fromMock = vi.fn((table: string) => {
    const builder: {
      select: () => typeof builder;
      then: (resolve: (v: { data: Row[]; error: unknown }) => void) => void;
    } = {
      select: () => builder,
      then: (resolve) => {
        const data =
          table === "vehicle_scores"
            ? (rows.vehicle_scores ?? [])
            : table === "vehicle_universe"
              ? (rows.vehicle_universe ?? [])
              : [];
        resolve({ data, error: null });
      },
    };
    return builder;
  });
  return { sb: { from: fromMock } };
}

describe("loadVehicleUniverse", () => {
  it("returns an empty array when no scores exist", async () => {
    const { sb } = makeStub({ vehicle_scores: [] });
    const result = await loadVehicleUniverse(sb);
    expect(result).toEqual([]);
  });

  it("maps vehicle_scores + vehicle_universe rows into the client shape", async () => {
    const { sb } = makeStub({
      vehicle_scores: [
        {
          ticker: "O",
          vehicle_type: "us_reit",
          resilience_score: 81,
          quality_gate_passed: true,
          computed_at: "2026-06-23T09:00:00Z",
        },
      ],
      vehicle_universe: [
        {
          ticker: "O",
          display_name: "Realty Income",
          sub_sector: "retail_net_lease",
          dividend_yield: 0.056,
          leverage_headline: "FFO payout 81%",
        },
      ],
    });
    const result = await loadVehicleUniverse(sb);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ticker: "O",
      vehicleType: "us_reit",
      displayName: "Realty Income",
      subSector: "retail_net_lease",
      resilienceScore: 81,
      qualityGatePassed: true,
      dividendYield: 0.056,
      leverageHeadline: "FFO payout 81%",
      computedAt: "2026-06-23T09:00:00Z",
    });
  });

  it("tolerates a missing universe row by falling back to ticker as displayName", async () => {
    const { sb } = makeStub({
      vehicle_scores: [
        {
          ticker: "ORPH",
          vehicle_type: "us_reit",
          resilience_score: 50,
          quality_gate_passed: true,
          computed_at: "2026-06-23T09:00:00Z",
        },
      ],
      vehicle_universe: [],
    });
    const result = await loadVehicleUniverse(sb);
    expect(result[0].displayName).toBe("ORPH");
    expect(result[0].subSector).toBeNull();
    expect(result[0].dividendYield).toBeNull();
    expect(result[0].leverageHeadline).toBe("");
  });
});

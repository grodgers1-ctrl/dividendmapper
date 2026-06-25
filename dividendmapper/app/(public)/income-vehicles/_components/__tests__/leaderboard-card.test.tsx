import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardCard } from "../leaderboard-card";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

function row(overrides: Partial<VehicleUniverseRow>): VehicleUniverseRow {
  return {
    ticker: "X",
    vehicleType: "us_reit",
    displayName: "X",
    subSector: null,
    resilienceScore: 50,
    qualityGatePassed: true,
    dividendYield: null,
    leverageHeadline: "",
    computedAt: "2026-06-23T09:00:00Z",
    ...overrides,
  };
}

describe("<LeaderboardCard>", () => {
  it("renders the top N rows of the given family in resilience-desc order, excluding gate-failed", () => {
    const universe = [
      row({ ticker: "O", vehicleType: "us_reit", displayName: "Realty Income", resilienceScore: 81 }),
      row({ ticker: "PSA", vehicleType: "us_reit", displayName: "Public Storage", resilienceScore: 78 }),
      row({ ticker: "BAD", vehicleType: "us_reit", displayName: "Gate-failed", resilienceScore: null, qualityGatePassed: false }),
      row({ ticker: "MAIN", vehicleType: "us_bdc", displayName: "Main Street Capital", resilienceScore: 73 }),
    ];
    render(<LeaderboardCard vehicleType="us_reit" universe={universe} topN={3} />);
    expect(screen.getByText("Top US REITs")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    // BAD is gate-failed and excluded; MAIN is wrong family.
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("O");
    expect(links[0]).toHaveTextContent("Realty Income");
    expect(links[1]).toHaveTextContent("PSA");
  });
});

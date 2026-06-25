import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const universeRows = [
  {
    ticker: "O",
    vehicleType: "us_reit",
    displayName: "Realty Income",
    subSector: "retail_net_lease",
    resilienceScore: 81,
    qualityGatePassed: true,
    dividendYield: 0.056,
    leverageHeadline: "FFO payout 81%",
    computedAt: "2026-06-23T09:00:00Z",
  },
  {
    ticker: "MAIN",
    vehicleType: "us_bdc",
    displayName: "Main Street Capital",
    subSector: "internally_managed_bdc",
    resilienceScore: 73,
    qualityGatePassed: true,
    dividendYield: 0.062,
    leverageHeadline: "NII coverage 1.05×",
    computedAt: "2026-06-23T09:00:00Z",
  },
];

vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({}),
}));

vi.mock("@/lib/scoring/load-vehicle-universe", () => ({
  loadVehicleUniverse: vi.fn(async () => universeRows),
}));

describe("/income-vehicles page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the H1, the three family leaderboards, and the screener table", async () => {
    const { default: Page } = await import("../page");
    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Income vehicles, ranked by dividend resilience/,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Top US REITs")).toBeInTheDocument();
    expect(screen.getByText("Top US BDCs")).toBeInTheDocument();
    expect(screen.getByText("Top UK REITs")).toBeInTheDocument();

    // Screener table renders both rows.
    expect(screen.getAllByText("O").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAIN").length).toBeGreaterThan(0);

    // Microstat strip computes "2 scored vehicles" from the fixture.
    expect(screen.getByText(/2 scored vehicles · 3 families/)).toBeInTheDocument();

    // Static Pro CTA tile mounted unconditionally.
    expect(screen.getByRole("heading", { level: 2, name: /Want saved screens/ })).toBeInTheDocument();
  });
});

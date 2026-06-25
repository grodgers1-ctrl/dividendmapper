import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Screener } from "../screener";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

const UNIVERSE: VehicleUniverseRow[] = [
  row({ ticker: "O", displayName: "Realty Income", resilienceScore: 81 }),
  row({ ticker: "MAIN", vehicleType: "us_bdc", displayName: "Main Street Capital", resilienceScore: 73 }),
  row({ ticker: "BLND.L", vehicleType: "uk_reit", displayName: "British Land", resilienceScore: 65 }),
];

afterEach(() => vi.restoreAllMocks());

describe("<Screener>", () => {
  it("renders one row per universe entry by default", () => {
    render(<Screener universe={UNIVERSE} />);
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.getByText("BLND.L")).toBeInTheDocument();
    expect(screen.getByText(/Filtered results — 3 vehicles/)).toBeInTheDocument();
  });

  it("narrows by family chip", async () => {
    const user = userEvent.setup();
    render(<Screener universe={UNIVERSE} />);
    await user.click(screen.getByRole("button", { name: "BDCs" }));
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.queryByText("O")).not.toBeInTheDocument();
    expect(screen.queryByText("BLND.L")).not.toBeInTheDocument();
    expect(screen.getByText(/Filtered results — 1 vehicle/)).toBeInTheDocument();
  });

  it("narrows the table when typing in the search box", async () => {
    const user = userEvent.setup();
    render(<Screener universe={UNIVERSE} />);
    await user.type(
      screen.getByPlaceholderText(/Search by ticker or name/),
      "british",
    );
    expect(screen.getByText("BLND.L")).toBeInTheDocument();
    expect(screen.queryByText("O")).not.toBeInTheDocument();
  });

  it("search ranking is preserved (exact ticker first, not re-sorted by resilience)", async () => {
    const user = userEvent.setup();
    render(<Screener universe={UNIVERSE} />);
    // MAIN has lower resilience (73) than O (81); without the fix the trailing
    // resilience-desc sort would put O first. Typing MAIN must put MAIN first.
    await user.type(
      screen.getByPlaceholderText(/Search by ticker or name/),
      "MAIN",
    );
    const rows = screen.getAllByRole("row");
    // rows[0] is the <thead> row; rows[1] is the first <tbody> row.
    expect(rows[1]).toHaveTextContent("MAIN");
  });

  it("resets stale sub-sector when switching family makes it invalid", async () => {
    const user = userEvent.setup();
    const universe = [
      row({ ticker: "O", vehicleType: "us_reit", subSector: "retail_net_lease" }),
      row({ ticker: "MAIN", vehicleType: "us_bdc", subSector: "internally_managed_bdc" }),
    ];
    render(<Screener universe={universe} />);
    // Pick BDCs, then internally_managed_bdc, then switch to REITs.
    await user.click(screen.getByRole("button", { name: "BDCs" }));
    await user.selectOptions(screen.getByRole("combobox"), "internally_managed_bdc");
    await user.click(screen.getByRole("button", { name: "REITs" }));
    // Sub-sector resets to "" (All sub-sectors); O is visible again.
    expect(screen.getByText("O")).toBeInTheDocument();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });

  it("when ownedTickers is set, the holdings toggle narrows the universe to those tickers", async () => {
    const user = userEvent.setup();
    render(
      <Screener
        universe={UNIVERSE}
        showSaveScreenAction
        ownedTickers={["MAIN"]}
      />,
    );
    // Toggle is off by default — full universe shows.
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("MAIN")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Only my holdings/ }));
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.queryByText("O")).not.toBeInTheDocument();
    expect(screen.queryByText("BLND.L")).not.toBeInTheDocument();
  });

  it("empty-state hint renders when 'Only my holdings' toggle yields zero rows", async () => {
    const user = userEvent.setup();
    render(
      <Screener
        universe={UNIVERSE}
        showSaveScreenAction
        ownedTickers={[]}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Only my holdings/ }));
    expect(
      screen.getByText(/haven't added any income vehicles/i),
    ).toBeInTheDocument();
  });
});

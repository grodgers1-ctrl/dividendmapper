import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoldingsTable } from "../holdings-table";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

function row(id: string, ticker: string) {
  return {
    id,
    ticker,
    quantity: 100,
    avg_cost: 25,
    cost_currency: "USD",
    wrapper: "isa",
    broker_label: null,
    notes: null,
    created_at: "2026-05-01T00:00:00Z",
  };
}

const pepScore: HoldingScore = {
  ticker: "PEP",
  buy: 76,
  trim: 22,
  risk: 45,
  buyFailedGates: [],
  buyGateReason: null,
  dataQuality: "sparse",
  deltas: { buy: null, trim: null, risk: null },
  hidden: { buy: false, trim: false, risk: false },
  actionHint: "Hold",
};

const schdScore: HoldingScore = {
  ticker: "SCHD",
  buy: null,
  trim: 88,
  risk: 60,
  buyFailedGates: ["GATE_4"],
  buyGateReason: "ETF or fund, not company-scored",
  dataQuality: "sparse",
  deltas: { buy: null, trim: null, risk: null },
  hidden: { buy: false, trim: false, risk: false },
  actionHint: "Reassess thesis",
};

beforeEach(() => {
  window.localStorage.clear();
  pushMock.mockClear();
  refreshMock.mockClear();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ticker: "PEP", buyScore: 76, trimScore: 22, riskScore: 45, buyQualityGatePassed: true, buyFailedGates: [], dataQuality: "sparse", computedAt: "x", signals: { buy: [], trim: [], risk: [] } }),
  }) as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

describe("<HoldingsTable> column set (portfolio defaults)", () => {
  it("does not render a Wrapper column header", () => {
    render(
      <HoldingsTable
        rows={[row("1", "PEP")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /^wrapper$/i })).toBeNull();
  });

  it("does not render a Scores column header when showScores=false and no vehicle chips", () => {
    render(
      <HoldingsTable
        rows={[row("1", "PEP")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /scores/i })).toBeNull();
  });

  it("renders a HoldingLogo at the start of each row, followed by ticker + name + wrapper line", () => {
    const { container } = render(
      <HoldingsTable
        rows={[row("1", "AAPL")]}
        quotes={{}}
        nameByTicker={{ AAPL: "Apple Inc." }}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const tickerCell = container.querySelector(
      "[data-testid='row-ticker-cell-AAPL']",
    );
    expect(tickerCell).not.toBeNull();
    expect(tickerCell?.textContent).toContain("AAPL");
    expect(tickerCell?.textContent).toContain("Apple Inc.");
    expect(tickerCell?.textContent).toContain("ISA");
    expect(tickerCell?.textContent).toContain("USD");
    expect(tickerCell?.querySelector("img,[role='img']")).not.toBeNull();
  });

  it("renders the RowSparkline in the sparkline cell when series data is present", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    render(
      <HoldingsTable
        rows={[row("1", "AAPL")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
        sparklineByTicker={
          new Map([
            [
              "AAPL",
              { points, firstClose: 100, lastClose: 129, currency: "USD" },
            ],
          ])
        }
      />,
    );
    const table = screen.getByRole("table");
    expect(
      within(table).getByLabelText(/AAPL.*price line/i),
    ).toBeInTheDocument();
  });

  it("renders the Collecting pill when a row has no sparkline series", () => {
    render(
      <HoldingsTable
        rows={[row("1", "AAPL")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
        sparklineByTicker={new Map()}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText(/Collecting/)).toBeInTheDocument();
  });

  it("renders the Sparkline column header (visually hidden)", () => {
    render(
      <HoldingsTable
        rows={[row("1", "PEP")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.toLowerCase().trim() ?? "");
    expect(headers).toContain("sparkline");
  });
});

describe("<HoldingsTable> 2dp formatting + PortfolioBar", () => {
  it("renders Quantity to 2dp with full-precision title", () => {
    const { container } = render(
      <HoldingsTable
        rows={[
          {
            id: "1",
            ticker: "TW.L",
            quantity: 994.790201,
            avg_cost: 0.9968,
            cost_currency: "GBP",
            wrapper: "isa",
            broker_label: null,
            notes: null,
            created_at: "2026-01-01",
          },
        ]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const cell = container.querySelector(
      "[data-testid='row-quantity-1']",
    ) as HTMLElement;
    expect(cell.textContent).toBe("994.79");
    expect(cell.title).toContain("994.790201");
  });

  it("renders Avg cost to 2dp", () => {
    const { container } = render(
      <HoldingsTable
        rows={[
          {
            id: "1",
            ticker: "TW.L",
            quantity: 1,
            avg_cost: 0.9968,
            cost_currency: "GBP",
            wrapper: "isa",
            broker_label: null,
            notes: null,
            created_at: "2026-01-01",
          },
        ]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    expect(
      container.querySelector("[data-testid='row-cost-1']")?.textContent,
    ).toBe("£1.00");
  });

  it("renders the PortfolioBar inside the Value cell when totals are present", () => {
    const { container } = render(
      <HoldingsTable
        rows={[
          {
            id: "1",
            ticker: "AAPL",
            quantity: 10,
            avg_cost: 100,
            cost_currency: "USD",
            wrapper: "isa",
            broker_label: null,
            notes: null,
            created_at: "2026-01-01",
          },
        ]}
        quotes={{}}
        priceByTicker={{ AAPL: { price: 200, currency: "USD" } }}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const valueCell = container.querySelector(
      "[data-testid='row-value-1']",
    ) as HTMLElement;
    expect(valueCell.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("<HoldingsTable> whole-row click + Edit placeholder", () => {
  const baseRow = row("1", "AAPL");
  const baseProps = {
    rows: [baseRow],
    quotes: {},
    tier: "pro" as const,
    pricingPublic: true,
    isBeta: true,
    scoresByTicker: {},
    showScores: false,
  };

  it("navigates to /app/portfolio/[ticker] when a row body is clicked", () => {
    const { container } = render(<HoldingsTable {...baseProps} />);
    const row = container.querySelector("tr[role='link']") as HTMLElement;
    expect(row).not.toBeNull();
    fireEvent.click(row);
    expect(pushMock).toHaveBeenCalledWith("/app/portfolio/AAPL");
  });

  it("does NOT navigate when an action button is clicked", () => {
    render(<HoldingsTable {...baseProps} />);
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByLabelText("Delete AAPL"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does NOT navigate when there is an active text selection inside the row", () => {
    const { container } = render(<HoldingsTable {...baseProps} />);
    const row = container.querySelector("tr[role='link']") as HTMLElement;
    const realGetSelection = window.getSelection;
    window.getSelection = () =>
      ({
        toString: () => "$100",
        anchorNode: row,
      }) as unknown as Selection;
    fireEvent.click(row);
    expect(pushMock).not.toHaveBeenCalled();
    window.getSelection = realGetSelection;
  });

  it("renders an Edit placeholder that is disabled with title='Edit coming soon'", () => {
    render(<HoldingsTable {...baseProps} />);
    const table = screen.getByRole("table");
    const edit = within(table).getByLabelText("Edit AAPL") as HTMLButtonElement;
    expect(edit.getAttribute("aria-disabled")).toBe("true");
    expect(edit.title).toBe("Edit coming soon");
    fireEvent.click(edit);
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("<HoldingsTable> score column (Pro)", () => {
  const props = {
    rows: [row("1", "PEP"), row("2", "SCHD")],
    quotes: {},
    tier: "pro" as const,
    pricingPublic: true,
    isBeta: true,
    scoresByTicker: { PEP: pepScore, SCHD: schdScore },
    showScores: true,
  };

  it("hides the Scores column header when showScores is false", () => {
    render(<HoldingsTable {...props} showScores={false} />);
    expect(screen.queryByRole("columnheader", { name: "Scores" })).toBeNull();
    expect(screen.queryByText("76")).not.toBeInTheDocument();
  });

  it("shows the Scores column header when showScores is true", () => {
    render(<HoldingsTable {...props} />);
    expect(
      screen.getByRole("columnheader", { name: "Scores" }),
    ).toBeInTheDocument();
  });

  it("renders three chips + action hint for a gate-passer", () => {
    render(<HoldingsTable {...props} />);
    // Desktop table is the first matching region; scope to it.
    const table = screen.getByRole("table");
    expect(within(table).getByText("76")).toBeInTheDocument();
    expect(within(table).getByText("22")).toBeInTheDocument();
    expect(within(table).getByText("45")).toBeInTheDocument();
    expect(within(table).getAllByText(/Hold/).length).toBeGreaterThan(0);
  });

  it("shows a DNQ chip (reason on hover) for a gate-failer plus its trim/risk chips", () => {
    render(<HoldingsTable {...props} />);
    const table = screen.getByRole("table");
    const dnq = within(table).getByText("DNQ");
    expect(dnq.closest("button")).toHaveAttribute("title", "ETF or fund, not company-scored");
    expect(within(table).getByText("88")).toBeInTheDocument();
    expect(within(table).getByText("60")).toBeInTheDocument();
  });

  it("opens the drawer (fetching the ticker) when a chip is clicked", async () => {
    const user = userEvent.setup();
    render(<HoldingsTable {...props} />);
    const table = screen.getByRole("table");
    await user.click(within(table).getByText("76"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/scoring/PEP");
    });
  });

  it("renders a mobile collapsed score pill", () => {
    render(<HoldingsTable {...props} />);
    expect(screen.getAllByTestId("mobile-score-pill").length).toBeGreaterThan(0);
  });

  it("shows a Collecting pill for a Pro holding not yet scored", () => {
    render(
      <HoldingsTable
        rows={[row("9", "NEWCO")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={true}
      />,
    );
    expect(screen.getAllByText(/collecting/i).length).toBeGreaterThan(0);
    // a plain dash must NOT be used for the not-yet-scored state
    const table = screen.getByRole("table");
    expect(within(table).getByTestId("pending-score-pill")).toBeInTheDocument();
  });
});

describe("<HoldingsTable> Value + Received columns", () => {
  it("renders the position value from priceByTicker (qty × price)", () => {
    render(
      <HoldingsTable
        rows={[row("1", "MSFT")]}
        quotes={{}}
        priceByTicker={{ MSFT: { price: 400, currency: "USD" } }}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    // 100 shares × $400 = $40,000
    const table = screen.getByRole("table");
    expect(within(table).getByText("$40,000")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Value" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /Received/ }),
    ).toBeInTheDocument();
  });

  it("renders real received dividends from actualsByKey for the holding's wrapper", () => {
    render(
      <HoldingsTable
        rows={[row("1", "TW.L")]}
        quotes={{}}
        actualsByKey={{ "TW.L::isa": { amount: 112, currency: "GBP" } }}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("£112")).toBeInTheDocument();
  });

  it("shows the company name under the ticker when supplied", () => {
    render(
      <HoldingsTable
        rows={[row("1", "MSFT")]}
        quotes={{}}
        nameByTicker={{ MSFT: "Microsoft Corporation" }}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    expect(screen.getAllByText("Microsoft Corporation").length).toBeGreaterThan(0);
  });

  it("shows only the ticker when no name is supplied (manual/unscored)", () => {
    render(
      <HoldingsTable
        rows={[row("1", "MSFT")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("MSFT")).toBeInTheDocument();
    expect(screen.queryByText("Microsoft Corporation")).not.toBeInTheDocument();
  });

  it("shows a dash for value when the ticker is not yet priced", () => {
    render(
      <HoldingsTable
        rows={[row("1", "NEW")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
      />,
    );
    const table = screen.getByRole("table");
    expect(
      within(table).getByTitle(/Value appears after the next nightly price update/),
    ).toBeInTheDocument();
  });
});

describe("<HoldingsTable> sort control", () => {
  const sortProps = {
    rows: [row("1", "AAPL"), row("2", "MSFT")],
    quotes: {},
    // MSFT worth more than AAPL: 100×400 vs 100×200.
    priceByTicker: {
      AAPL: { price: 200, currency: "USD" },
      MSFT: { price: 400, currency: "USD" },
    },
    tier: "pro" as const,
    pricingPublic: true,
    isBeta: true,
    scoresByTicker: {},
    showScores: false,
  };

  function firstDataRowTicker() {
    const table = screen.getByRole("table");
    const tbodyRow = table.querySelector("tbody tr");
    return tbodyRow?.querySelector("td")?.textContent ?? "";
  }

  it("defaults to value-desc (highest value first)", () => {
    render(<HoldingsTable {...sortProps} />);
    expect(firstDataRowTicker()).toContain("MSFT");
  });

  it("reorders and persists when the user picks a different sort", async () => {
    const user = userEvent.setup();
    render(<HoldingsTable {...sortProps} />);
    // Day 8 swap: native <select> → base-ui <Select>. The table also has a
    // "Ticker" column header, so we have to scope the option lookup to the
    // portal-rendered popup. Wait for the listbox to mount, then pick the
    // option inside it.
    await user.click(screen.getByLabelText("Sort"));
    const listbox = await screen.findByRole("listbox");
    const ticker = within(listbox).getByText(/Ticker \(A.*Z\)/);
    await user.click(ticker);
    expect(firstDataRowTicker()).toContain("AAPL");
    expect(window.localStorage.getItem("dm.holdings-sort")).toBe("ticker");
  });
});

describe("<HoldingsTable> vehicle chip", () => {
  it("renders a VehicleChip for a vehicle-typed ticker (Pro tier, no equity scores)", () => {
    render(
      <HoldingsTable
        rows={[row("1", "O"), row("2", "AAPL")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        // On /app/portfolio, the equity Scores column is suppressed for Pro.
        // Vehicle chips must still appear because resilience scores are public.
        showScores={false}
        vehicleScoresByTicker={{
          O: { vehicleType: "us_reit", resilienceScore: 72, qualityGatePassed: true },
        }}
      />,
    );
    const table = screen.getByRole("table");
    const chip = within(table).getByTestId("vehicle-chip");
    expect(chip).toHaveAttribute("data-vehicle-type", "us_reit");
    // "REIT" label + the score appear in the chip.
    expect(within(chip).getByText("REIT")).toBeInTheDocument();
    expect(within(chip).getByText("72")).toBeInTheDocument();
    // AAPL has no vehicle entry — only one chip in the table.
    expect(within(table).getAllByTestId("vehicle-chip")).toHaveLength(1);
    // Mobile card also surfaces the chip — both views render it.
    expect(screen.getAllByTestId("vehicle-chip")).toHaveLength(2);
  });

  it("opens the drawer against /api/vehicle-scoring/[ticker] when a vehicle chip is clicked", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ticker: "O",
        vehicleType: "us_reit",
        displayName: "Realty Income",
        resilienceScore: 72,
        qualityGatePassed: true,
        signals: [],
      }),
    }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(
      <HoldingsTable
        rows={[row("1", "O")]}
        quotes={{}}
        tier="pro"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={false}
        vehicleScoresByTicker={{
          O: { vehicleType: "us_reit", resilienceScore: 72, qualityGatePassed: true },
        }}
      />,
    );
    const table = screen.getByRole("table");
    await user.click(within(table).getByTestId("vehicle-chip"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/vehicle-scoring/O");
    });
  });
});

describe("<HoldingsTable> score column (Free)", () => {
  it("shows the upgrade pill instead of chips", () => {
    render(
      <HoldingsTable
        rows={[row("1", "PEP")]}
        quotes={{}}
        tier="free"
        pricingPublic={true}
        isBeta={true}
        scoresByTicker={{}}
        showScores={true}
      />,
    );
    expect(screen.getAllByRole("link", { name: /upgrade to pro/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("76")).not.toBeInTheDocument();
  });
});

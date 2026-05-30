import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoldingsTable } from "../holdings-table";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
  actionHint: "Add more",
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
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ticker: "PEP", buyScore: 76, trimScore: 22, riskScore: 45, buyQualityGatePassed: true, buyFailedGates: [], dataQuality: "sparse", computedAt: "x", signals: { buy: [], trim: [], risk: [] } }),
  }) as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

describe("<HoldingsTable> score column (Pro)", () => {
  const props = {
    rows: [row("1", "PEP"), row("2", "SCHD")],
    quotes: {},
    tier: "pro" as const,
    pricingPublic: true,
    isBeta: true,
    scoresByTicker: { PEP: pepScore, SCHD: schdScore },
  };

  it("renders three chips + action hint for a gate-passer", () => {
    render(<HoldingsTable {...props} />);
    // Desktop table is the first matching region; scope to it.
    const table = screen.getByRole("table");
    expect(within(table).getByText("76")).toBeInTheDocument();
    expect(within(table).getByText("22")).toBeInTheDocument();
    expect(within(table).getByText("45")).toBeInTheDocument();
    expect(within(table).getAllByText(/Add more/).length).toBeGreaterThan(0);
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
      />,
    );
    expect(screen.getAllByRole("link", { name: /upgrade to pro/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("76")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreDrawer } from "../score-drawer";

const payload = {
  ticker: "PEP",
  buyScore: 76,
  trimScore: 22,
  riskScore: 45,
  buyQualityGatePassed: true,
  buyFailedGates: [],
  dataQuality: "sparse",
  computedAt: "2026-05-29T22:30:00Z",
  signals: {
    buy: [
      { signalCode: "D2", humanLabel: "Ex-dividend in 6 days", contribution: 100, rawPoints: null, weight: 1 },
      { signalCode: "A1", humanLabel: "Yield 88th percentile", contribution: 44, rawPoints: null, weight: 0.5 },
    ],
    trim: [],
    risk: [],
  },
};

function mockFetchOnce(body: unknown, ok = true) {
  (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 404,
    json: async () => body,
  });
}

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("<ScoreDrawer>", () => {
  it("fetches the ticker and renders its signal labels", async () => {
    mockFetchOnce(payload);
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open onOpenChange={() => {}} />);
    expect(await screen.findByText("Ex-dividend in 6 days")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/scoring/PEP");
  });

  it("renders the big active score for the clicked type", async () => {
    mockFetchOnce(payload);
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open onOpenChange={() => {}} />);
    expect(await screen.findByTestId("drawer-active-score")).toHaveTextContent("76");
  });

  it("renders signal bars in the order received (already contribution-sorted)", async () => {
    mockFetchOnce(payload);
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open onOpenChange={() => {}} />);
    await screen.findByText("Ex-dividend in 6 days");
    const labels = screen.getAllByTestId("signal-bar-label").map((n) => n.textContent);
    expect(labels).toEqual(["Ex-dividend in 6 days", "Yield 88th percentile"]);
  });

  it("shows the gate reason instead of bars for a gate-failed buy score", async () => {
    mockFetchOnce({
      ...payload,
      ticker: "SCHD",
      buyScore: null,
      buyQualityGatePassed: false,
      buyFailedGates: ["GATE_4"],
      signals: { buy: [], trim: [], risk: [] },
    });
    render(<ScoreDrawer ticker="SCHD" scoreType="buy" open onOpenChange={() => {}} />);
    expect(await screen.findByText("ETF or fund, not company-scored")).toBeInTheDocument();
  });

  it("POSTs an override when Hide this score is clicked", async () => {
    mockFetchOnce(payload);
    mockFetchOnce({ ok: true }); // the override POST
    const user = userEvent.setup();
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open onOpenChange={() => {}} />);
    await screen.findByText("Ex-dividend in 6 days");
    await user.click(screen.getByRole("button", { name: /hide this score/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/scoring/overrides",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "/api/scoring/overrides",
    );
    expect(JSON.parse(call![1].body)).toEqual({ ticker: "PEP", scoreType: "buy" });
  });

  it("shows the dimmed sparkline placeholder", async () => {
    mockFetchOnce(payload);
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open onOpenChange={() => {}} />);
    expect(await screen.findByText(/trend chart available/i)).toBeInTheDocument();
  });

  it("shows the not-financial-advice footer with a methodology link", async () => {
    mockFetchOnce(payload);
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open onOpenChange={() => {}} />);
    await screen.findByText("Ex-dividend in 6 days");
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /methodology/i });
    expect(link).toHaveAttribute("href", "/legal/scoring-methodology");
  });

  it("shows the beta disclaimer when isBeta", async () => {
    mockFetchOnce(payload);
    render(<ScoreDrawer ticker="PEP" scoreType="buy" open isBeta onOpenChange={() => {}} />);
    await screen.findByText("Ex-dividend in 6 days");
    expect(screen.getByText(/beta/i)).toBeInTheDocument();
  });
});

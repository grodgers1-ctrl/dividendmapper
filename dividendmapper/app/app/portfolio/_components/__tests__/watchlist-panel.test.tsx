import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchlistPanel, type WatchRow } from "../watchlist-panel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const scoredRow: WatchRow = {
  id: "t1",
  ticker: "AAPL",
  buyScore: 72,
  trimScore: 40,
  riskScore: 30,
  buyGateReason: null,
  scored: true,
};

describe("WatchlistPanel", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) }));
  });

  it("shows an empty state with no rows", () => {
    render(<WatchlistPanel rows={[]} isBeta={false} />);
    expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
  });

  it("renders a scored row with its three score chips", () => {
    render(<WatchlistPanel rows={[scoredRow]} isBeta={false} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getAllByTestId("score-chip")).toHaveLength(3);
  });

  it("shows Collecting… for an unscored row", () => {
    render(<WatchlistPanel rows={[{ ...scoredRow, scored: false }]} isBeta={false} />);
    expect(screen.getByText(/collecting/i)).toBeInTheDocument();
  });

  it("the add button is disabled until a ticker is selected", () => {
    render(<WatchlistPanel rows={[]} isBeta={false} />);
    expect(screen.getByRole("button", { name: /add to watchlist/i })).toBeDisabled();
  });

  it("remove sends a DELETE for that ticker and refreshes", async () => {
    const user = userEvent.setup();
    render(<WatchlistPanel rows={[scoredRow]} isBeta={false} />);
    await user.click(screen.getByRole("button", { name: /remove aapl/i }));
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/tracked-tickers?ticker=AAPL",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refresh).toHaveBeenCalled();
  });
});

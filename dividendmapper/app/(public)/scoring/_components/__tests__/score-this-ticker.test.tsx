import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ScoreThisTicker } from "../score-this-ticker";

function mockFetchOnce(status: number, body: Record<string, unknown>) {
  const json = vi.fn().mockResolvedValue(body);
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json,
  } as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<ScoreThisTicker>", () => {
  it("renders the 'Scoring...' state on mount and POSTs to the compute endpoint", async () => {
    const spy = mockFetchOnce(200, { ok: true, ticker: "AAPL" });
    render(<ScoreThisTicker ticker="AAPL" />);
    expect(screen.getByText(/Scoring AAPL/)).toBeInTheDocument();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith(
      "/api/scoring/AAPL/compute",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls router.refresh on a 200 response", async () => {
    mockFetchOnce(200, { ok: true, ticker: "AAPL" });
    render(<ScoreThisTicker ticker="AAPL" />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("renders the signup wall on 429 tier=anon", async () => {
    mockFetchOnce(429, { error: "rate_limited", tier: "anon" });
    render(<ScoreThisTicker ticker="AAPL" />);
    await waitFor(() =>
      expect(screen.getByText(/used your two free scores today/i)).toBeInTheDocument(),
    );
  });

  it("renders the countdown on 429 tier=free with the right secondsLeft", async () => {
    mockFetchOnce(429, { error: "rate_limited", tier: "free", retryAfter: 47 });
    render(<ScoreThisTicker ticker="AAPL" />);
    await waitFor(() => expect(screen.getByText(/47s/)).toBeInTheDocument());
  });

  it("renders the uncoverable state on 422", async () => {
    mockFetchOnce(422, { error: "ticker_not_coverable" });
    render(<ScoreThisTicker ticker="XYZGARBAGE" />);
    await waitFor(() =>
      expect(screen.getByText(/couldn.t pull data for XYZGARBAGE/i)).toBeInTheDocument(),
    );
  });

  it("renders the generic error state on a 500", async () => {
    mockFetchOnce(500, { error: "server_misconfigured" });
    render(<ScoreThisTicker ticker="AAPL" />);
    await waitFor(() =>
      expect(screen.getByText(/Something went wrong scoring AAPL/)).toBeInTheDocument(),
    );
  });

  it("renders the error state when fetch rejects (network drop)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("net"));
    render(<ScoreThisTicker ticker="AAPL" />);
    await waitFor(() =>
      expect(screen.getByText(/Something went wrong scoring AAPL/)).toBeInTheDocument(),
    );
  });
});

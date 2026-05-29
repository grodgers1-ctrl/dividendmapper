import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TickerSearch } from "../ticker-search";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("<TickerSearch>", () => {
  it("renders an empty combobox initially", () => {
    render(<TickerSearch onSelect={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("does not call /api/search/tickers for queries shorter than 2 chars", async () => {
    const user = userEvent.setup();
    render(<TickerSearch onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "l");
    await new Promise((r) => setTimeout(r, 350));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls /api/search/tickers after 250ms debounce", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<TickerSearch onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "lega");
    await waitFor(
      () => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/search/tickers?q=lega"), expect.anything()),
      { timeout: 600 },
    );
  });

  it("renders each result as [SYMBOL] Company · Exchange", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        results: [
          { symbol: "LGEN.L", name: "Legal & General Group", exchange: "LSE", currency: "GBp", exchangeFullName: "London Stock Exchange" },
        ],
      }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<TickerSearch onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "lega");
    await waitFor(() => expect(screen.getByText(/LGEN\.L/)).toBeInTheDocument(), { timeout: 600 });
    expect(screen.getByText(/Legal & General Group/)).toBeInTheDocument();
    expect(screen.getByText(/LSE/)).toBeInTheDocument();
  });

  it("calls onSelect with the chosen result", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        results: [
          { symbol: "LGEN.L", name: "Legal & General Group", exchange: "LSE", currency: "GBp", exchangeFullName: "London Stock Exchange" },
        ],
      }), { status: 200 }),
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TickerSearch onSelect={onSelect} />);
    await user.type(screen.getByRole("combobox"), "lega");
    await waitFor(() => expect(screen.getByText(/LGEN\.L/)).toBeInTheDocument(), { timeout: 600 });
    await user.click(screen.getByText(/LGEN\.L/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: "LGEN.L" }));
  });

  it("paste fallback: typing exact symbol AAPL and pressing Enter auto-selects when single match", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        results: [
          { symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ", currency: "USD", exchangeFullName: "NASDAQ" },
        ],
      }), { status: 200 }),
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TickerSearch onSelect={onSelect} />);
    await user.type(screen.getByRole("combobox"), "AAPL");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 600 });
    // Wait for results to land in state before keypress
    await waitFor(() => expect(screen.getByText(/AAPL/)).toBeInTheDocument(), { timeout: 600 });
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: "AAPL" }));
  });

  it("disabled state forwards", () => {
    render(<TickerSearch onSelect={() => {}} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});

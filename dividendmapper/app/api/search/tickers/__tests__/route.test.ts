import { describe, it, expect, beforeEach, vi } from "vitest";

const searchSymbolMock = vi.fn();
const searchByNameMock = vi.fn();
vi.mock("@/lib/scoring/fmp-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scoring/fmp-client")>("@/lib/scoring/fmp-client");
  return {
    ...actual,
    searchSymbol: searchSymbolMock,
    searchByName: searchByNameMock,
  };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  searchSymbolMock.mockResolvedValue([]);
  searchByNameMock.mockResolvedValue([]);
});

describe("GET /api/search/tickers", () => {
  it("returns empty results when q is missing", async () => {
    const { GET } = await import("../route");
    const res = await GET(new Request("https://example.com/?"));
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(searchSymbolMock).not.toHaveBeenCalled();
  });

  it("returns empty when q.length < 2", async () => {
    const { GET } = await import("../route");
    const res = await GET(new Request("https://example.com/?q=a"));
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(searchSymbolMock).not.toHaveBeenCalled();
  });

  it("calls both searchSymbol and searchByName in parallel for q.length >= 2", async () => {
    searchSymbolMock.mockResolvedValueOnce([
      { symbol: "LGEN.L", name: "Legal & General Group", exchange: "LSE", currency: "GBp", exchangeFullName: "LSE" },
    ]);
    searchByNameMock.mockResolvedValueOnce([
      { symbol: "LZ", name: "LegalZoom", exchange: "NASDAQ", currency: "USD", exchangeFullName: "NASDAQ" },
    ]);
    const { GET } = await import("../route");
    const res = await GET(new Request("https://example.com/?q=lega"));
    const body = await res.json();
    expect(searchSymbolMock).toHaveBeenCalledWith("lega", 8);
    expect(searchByNameMock).toHaveBeenCalledWith("lega", 8);
    expect(body.results.length).toBeGreaterThan(0);
  });

  it("dedupes by symbol when both endpoints return the same ticker", async () => {
    const lgen = { symbol: "LGEN.L", name: "Legal & General", exchange: "LSE", currency: "GBp", exchangeFullName: "LSE" };
    searchSymbolMock.mockResolvedValueOnce([lgen]);
    searchByNameMock.mockResolvedValueOnce([lgen]);
    const { GET } = await import("../route");
    const res = await GET(new Request("https://example.com/?q=lgen"));
    const body = await res.json();
    const lgenCount = body.results.filter((r: { symbol: string }) => r.symbol === "LGEN.L").length;
    expect(lgenCount).toBe(1);
  });

  it("caps results at 8", async () => {
    searchSymbolMock.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        symbol: `SYM${i}`, name: `Co ${i}`, exchange: "NASDAQ", currency: "USD", exchangeFullName: "NASDAQ",
      })),
    );
    searchByNameMock.mockResolvedValueOnce([]);
    const { GET } = await import("../route");
    const res = await GET(new Request("https://example.com/?q=sym"));
    const body = await res.json();
    expect(body.results.length).toBeLessThanOrEqual(8);
  });

  it("returns 500 when FMP throws", async () => {
    searchSymbolMock.mockRejectedValueOnce(new Error("FMP down"));
    const { GET } = await import("../route");
    const res = await GET(new Request("https://example.com/?q=lega"));
    expect(res.status).toBe(500);
  });
});

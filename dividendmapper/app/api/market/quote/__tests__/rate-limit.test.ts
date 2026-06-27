import { describe, it, expect, beforeEach, vi } from "vitest";

// Default to anonymous (no claims) so the rate-limit path is exercised. The
// signed-in test below overrides this for one call.
const getClaimsMock = vi.fn(async () => ({ data: { claims: null }, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getClaims: getClaimsMock },
  })),
}));

vi.mock("@/lib/market/quote", () => ({
  fetchQuote: vi.fn(async () => ({
    ok: true,
    data: {
      ticker: "AAPL",
      price: 200,
      dividend: 1,
      dividendYield: 0.005,
      dividendGrowth3yr: 0.05,
      currency: "USD",
      exchange: "NASDAQ",
      name: "Apple",
      fetchedAt: new Date().toISOString(),
      source: "FMP",
    },
    cached: false,
  })),
}));

function reqWithIp(ip: string, ticker = "AAPL"): Request {
  return new Request(`http://test.local/api/market/quote?ticker=${ticker}`, {
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the module so the in-memory limiter starts fresh each test.
  vi.resetModules();
  getClaimsMock.mockResolvedValue({ data: { claims: null }, error: null });
});

describe("/api/market/quote rate-limit", () => {
  it("allows the first 30 anonymous requests from a single IP", async () => {
    const { GET } = await import("../route");
    for (let i = 0; i < 30; i++) {
      const res = await GET(reqWithIp("1.2.3.4"));
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 with a Retry-After header on the 31st request", async () => {
    const { GET } = await import("../route");
    for (let i = 0; i < 30; i++) await GET(reqWithIp("5.6.7.8"));
    const res = await GET(reqWithIp("5.6.7.8"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("buckets per-IP — a fresh IP is not affected by another IP's exhaustion", async () => {
    const { GET } = await import("../route");
    for (let i = 0; i < 30; i++) await GET(reqWithIp("9.9.9.9"));
    const blocked = await GET(reqWithIp("9.9.9.9"));
    expect(blocked.status).toBe(429);
    const fresh = await GET(reqWithIp("10.10.10.10"));
    expect(fresh.status).toBe(200);
  });

  it("exempts signed-in users — burst of 60 returns 200 throughout", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-123" } as any },
      error: null,
    });
    const { GET } = await import("../route");
    for (let i = 0; i < 60; i++) {
      const res = await GET(reqWithIp("99.99.99.99"));
      expect(res.status).toBe(200);
    }
  });
});

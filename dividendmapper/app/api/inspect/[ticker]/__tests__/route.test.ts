import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the inspect lib seams so the route runs hermetic — no Supabase, no FMP.
vi.mock("@/lib/inspect/get-current-user", () => ({
  getCurrentUserAndTier: vi.fn(),
}));
vi.mock("@/lib/inspect/read-cached-bundle", () => ({
  readCachedBundle: vi.fn(),
}));
vi.mock("@/lib/inspect/load-inspect-bundle", () => ({
  loadInspectBundle: vi.fn(),
}));
vi.mock("@/lib/inspect/inspect-rate-limit", () => ({
  checkInspectRateLimit: vi.fn(),
  recordInspectLookup: vi.fn(),
}));

import { getCurrentUserAndTier } from "@/lib/inspect/get-current-user";
import { readCachedBundle } from "@/lib/inspect/read-cached-bundle";
import { loadInspectBundle } from "@/lib/inspect/load-inspect-bundle";
import {
  checkInspectRateLimit,
  recordInspectLookup,
} from "@/lib/inspect/inspect-rate-limit";

const sampleQuarterlyRow = {
  ticker: "MSFT",
  observed_at: "2026-03-31",
  pe: 30,
  p_fcf: 25,
  net_debt_ebitda: 0.5,
  interest_coverage: 20,
  fcf_payout: 0.3,
  fcf_growth_yoy: 0.1,
  roic: 0.22,
  gross_margin: 0.7,
  operating_margin: 0.42,
  net_margin: 0.36,
};

const sampleMonthlyRow = {
  ticker: "MSFT",
  observed_at: "2026-03",
  dividend_yield: 0.012,
  dgr_3y: 0.1,
  dgr_5y: 0.11,
};

const sampleBundle = {
  ticker: "MSFT",
  quarterly: [
    sampleQuarterlyRow,
    { ...sampleQuarterlyRow, observed_at: "2025-12-31", pe: 28 },
    { ...sampleQuarterlyRow, observed_at: "2025-09-30", pe: 26 },
  ],
  monthly: [
    sampleMonthlyRow,
    { ...sampleMonthlyRow, observed_at: "2026-02", dividend_yield: 0.011 },
    { ...sampleMonthlyRow, observed_at: "2026-01", dividend_yield: 0.013 },
  ],
  rangeYearsQuarterly: 0.5,
  rangeYearsMonthly: 0.16,
};

function makeReq(): NextRequest {
  return new NextRequest(new URL("http://localhost/api/inspect/MSFT"), {
    headers: { "x-forwarded-for": "1.2.3.4" },
  });
}

const futureReset = () => new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: pro user, cache hit, allowed.
  vi.mocked(getCurrentUserAndTier).mockResolvedValue({
    user: { id: "user-pro", email: "pro@example.com" },
    tier: "pro",
  });
  vi.mocked(checkInspectRateLimit).mockResolvedValue({
    allowed: true,
    remaining: Infinity,
    resetAt: futureReset(),
  });
  vi.mocked(recordInspectLookup).mockResolvedValue(undefined);
  vi.mocked(readCachedBundle).mockResolvedValue(sampleBundle);
  vi.mocked(loadInspectBundle).mockResolvedValue({
    status: "ok",
    bundle: sampleBundle,
    cacheHit: false,
  });
});

describe("GET /api/inspect/[ticker]", () => {
  it("returns 200 + bundle for a pro user when the cache hits", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.ticker).toBe("MSFT");
    expect(body.bundle.ticker).toBe("MSFT");
    expect(body.current).toBeDefined();
    expect(body.percentiles).toBeDefined();
    expect(body.verdicts).toBeDefined();
    // cache hit means the loader is NOT consulted
    expect(loadInspectBundle).not.toHaveBeenCalled();
    // and the audit row is written with cacheHit=true
    expect(recordInspectLookup).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: true, ticker: "MSFT" }),
    );
  });

  it("pro user: first call misses cache → loader runs, subsequent calls hit cache", async () => {
    // First call: cache miss
    vi.mocked(readCachedBundle).mockResolvedValueOnce(null);
    const { GET } = await import("../route");

    const res1 = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(res1.status).toBe(200);
    expect(loadInspectBundle).toHaveBeenCalledTimes(1);
    expect(recordInspectLookup).toHaveBeenLastCalledWith(
      expect.objectContaining({ cacheHit: false }),
    );

    // Second call: default mock now returns the bundle (cache hit)
    const res2 = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(res2.status).toBe(200);
    expect(loadInspectBundle).toHaveBeenCalledTimes(1); // still 1 — cache hit
    expect(recordInspectLookup).toHaveBeenLastCalledWith(
      expect.objectContaining({ cacheHit: true }),
    );

    // Third call: same — cache hit
    const res3 = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(res3.status).toBe(200);
    expect(loadInspectBundle).toHaveBeenCalledTimes(1);
    expect(recordInspectLookup).toHaveBeenCalledTimes(3);
  });

  it("anon: 4th lookup is rate-limited with { tier: 'anon' }", async () => {
    vi.mocked(getCurrentUserAndTier).mockResolvedValue({
      user: null,
      tier: "free",
    });
    vi.mocked(checkInspectRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: futureReset(),
    });

    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("rate_limited");
    expect(body.tier).toBe("anon");
    // The rate-limiter was called with the anon bucket
    expect(checkInspectRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "anon", userId: null }),
    );
    // Audit is NOT written for rate-limited requests
    expect(recordInspectLookup).not.toHaveBeenCalled();
    // Loader is NOT called
    expect(loadInspectBundle).not.toHaveBeenCalled();
    expect(readCachedBundle).not.toHaveBeenCalled();
  });

  it("free: 11th lookup is rate-limited with { tier: 'free' }", async () => {
    vi.mocked(getCurrentUserAndTier).mockResolvedValue({
      user: { id: "user-free", email: "free@example.com" },
      tier: "free",
    });
    vi.mocked(checkInspectRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: futureReset(),
    });

    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.status).toBe("rate_limited");
    expect(body.tier).toBe("free");
    expect(checkInspectRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "free", userId: "user-free" }),
    );
  });

  it("uncoverable ticker returns 404 with { status: 'uncoverable' }", async () => {
    vi.mocked(readCachedBundle).mockResolvedValue(null);
    vi.mocked(loadInspectBundle).mockResolvedValue({ status: "uncoverable" });

    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe("uncoverable");
    // Audit still recorded so abuse via uncoverable tickers counts
    expect(recordInspectLookup).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: false }),
    );
  });

  it("rejects an invalid ticker with 400", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ ticker: "!!!" }),
    });
    expect(res.status).toBe(400);
    // No downstream calls
    expect(checkInspectRateLimit).not.toHaveBeenCalled();
    expect(readCachedBundle).not.toHaveBeenCalled();
  });
});

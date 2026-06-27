import { describe, it, expect, beforeEach, vi } from "vitest";

const scoreTicker = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scoring/score-ticker", () => ({
  scoreTicker: (...a: unknown[]) => scoreTicker(...a),
  isoDateOffset: (d: number) =>
    new Date(Date.now() + d * 86400000).toISOString().slice(0, 10),
}));
vi.mock("@/lib/scoring/fmp-client", () => ({
  getDividendsCalendar: vi.fn().mockResolvedValue([]),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// Admin client: insert + from-builder we can inspect.
const adminInsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      insert: adminInsert,
    })),
  }),
}));

// Configurable per-test fixtures for the RLS user client.
let userId: string | null = null;
let tier: "free" | "pro" | "premium" = "free";
let existingScoreComputedAt: string | null = null;
let auditCount: number = 0;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: userId ? { sub: userId } : null },
      }),
    },
    from: (table: string) => {
      if (table === "equity_scores") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: existingScoreComputedAt
                  ? { ticker: "AAPL", computed_at: existingScoreComputedAt }
                  : null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { tier } }) }),
          }),
        };
      }
      if (table === "scoring_lookup_audit") {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: auditCount, data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "../route";

function req(ip = "1.1.1.1"): Request {
  return new Request("http://test.local/api/scoring/AAPL/compute", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}
const params = (ticker: string) => ({ params: Promise.resolve({ ticker }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  userId = null;
  tier = "free";
  existingScoreComputedAt = null;
  auditCount = 0;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://sb";
});

describe("POST /api/scoring/[ticker]/compute — cooldown", () => {
  it("returns cached:true when computed_at is fresher than 12h", async () => {
    existingScoreComputedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await POST(req(), params("AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(scoreTicker).not.toHaveBeenCalled();
  });

  it("recomputes when computed_at is older than 12h", async () => {
    existingScoreComputedAt = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const res = await POST(req(), params("AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(false);
    expect(scoreTicker).toHaveBeenCalledOnce();
  });

  it("computes from scratch when no row exists yet", async () => {
    existingScoreComputedAt = null;
    const res = await POST(req(), params("AAPL"));
    expect(res.status).toBe(200);
    expect(scoreTicker).toHaveBeenCalledOnce();
  });
});

describe("POST /api/scoring/[ticker]/compute — anon rate-limit (2/IP/24h)", () => {
  it("allows when count is 0", async () => {
    auditCount = 0;
    const res = await POST(req("1.1.1.1"), params("AAPL"));
    expect(res.status).toBe(200);
    expect(scoreTicker).toHaveBeenCalledOnce();
  });

  it("allows when count is 1 (boundary)", async () => {
    auditCount = 1;
    const res = await POST(req("1.1.1.1"), params("AAPL"));
    expect(res.status).toBe(200);
  });

  it("returns 429 tier=anon when count is 2", async () => {
    auditCount = 2;
    const res = await POST(req("1.1.1.1"), params("AAPL"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.tier).toBe("anon");
    expect(scoreTicker).not.toHaveBeenCalled();
  });

  it("returns 429 tier=anon when count exceeds limit", async () => {
    auditCount = 50;
    const res = await POST(req("1.1.1.1"), params("AAPL"));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/scoring/[ticker]/compute — signed-in free (2/min/user)", () => {
  it("allows the 1st and 2nd lookups from a free user", async () => {
    userId = "user-free-1";
    tier = "free";
    const r1 = await POST(req(), params("AAPL"));
    expect(r1.status).toBe(200);
    const r2 = await POST(req(), params("MSFT"));
    expect(r2.status).toBe(200);
  });

  it("returns 429 tier=free with Retry-After on the 3rd within a minute", async () => {
    userId = "user-free-2";
    tier = "free";
    await POST(req(), params("AAPL"));
    await POST(req(), params("MSFT"));
    const res = await POST(req(), params("GOOG"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.tier).toBe("free");
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});

describe("POST /api/scoring/[ticker]/compute — Pro (unlimited)", () => {
  it("does not rate-limit Pro", async () => {
    userId = "user-pro-1";
    tier = "pro";
    for (let i = 0; i < 10; i++) {
      const res = await POST(req(), params("AAPL"));
      expect(res.status).toBe(200);
    }
  });

  it("treats premium as Pro", async () => {
    userId = "user-prem-1";
    tier = "premium";
    for (let i = 0; i < 10; i++) {
      const res = await POST(req(), params("AAPL"));
      expect(res.status).toBe(200);
    }
  });
});

describe("POST /api/scoring/[ticker]/compute — audit", () => {
  it("writes a scoring_lookup_audit row on anon success", async () => {
    const res = await POST(req("3.3.3.3"), params("AAPL"));
    expect(res.status).toBe(200);
    expect(adminInsert).toHaveBeenCalledWith({ ip: "3.3.3.3", ticker: "AAPL" });
  });

  it("does NOT write an audit row when signed-in free", async () => {
    userId = "user-free";
    tier = "free";
    await POST(req(), params("AAPL"));
    expect(adminInsert).not.toHaveBeenCalled();
  });

  it("does NOT write an audit row when Pro", async () => {
    userId = "user-pro";
    tier = "pro";
    await POST(req(), params("AAPL"));
    expect(adminInsert).not.toHaveBeenCalled();
  });

  it("does NOT write an audit row when scoreTicker throws (422)", async () => {
    scoreTicker.mockRejectedValueOnce(new Error("FMP gap"));
    const res = await POST(req("4.4.4.4"), params("XYZGARBAGE"));
    expect(res.status).toBe(422);
    expect(adminInsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/scoring/[ticker]/compute — input validation", () => {
  it("returns 400 for an invalid ticker", async () => {
    const res = await POST(req(), params("!!!"));
    expect(res.status).toBe(400);
  });

  it("returns 500 if service-role env is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(req(), params("AAPL"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/scoring/[ticker]/compute — uncoverable ticker", () => {
  it("returns 422 ticker_not_coverable when scoreTicker throws", async () => {
    scoreTicker.mockRejectedValueOnce(new Error("FMP returned 404"));
    const res = await POST(req(), params("XYZGARBAGE"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("ticker_not_coverable");
  });
});

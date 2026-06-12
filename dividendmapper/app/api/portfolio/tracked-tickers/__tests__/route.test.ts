import { describe, it, expect, vi, beforeEach } from "vitest";

const getClaims = vi.fn();
const profileTier = vi.fn(); // profiles.tier maybeSingle result
const trackedList = vi.fn(); // select(...).order(...) result
const trackedCount = vi.fn(); // select(id, { count, head }) result
const trackedInsert = vi.fn(); // insert(...).select(...).single() result
const trackedDelete = vi.fn(); // delete().eq() result

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => profileTier() }) }) };
      }
      // tracked_tickers
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) =>
          opts?.head ? trackedCount() : { order: () => trackedList() },
        insert: () => ({ select: () => ({ single: () => trackedInsert() }) }),
        delete: () => ({ eq: () => trackedDelete() }),
      };
    },
  }),
}));

import { GET, POST, DELETE } from "../route";

function postReq(body: unknown) {
  return new Request("http://x/api/portfolio/tracked-tickers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function delReq(qs: string) {
  return new Request(`http://x/api/portfolio/tracked-tickers${qs}`, { method: "DELETE" });
}

describe("/api/portfolio/tracked-tickers", () => {
  beforeEach(() => {
    getClaims.mockReset();
    profileTier.mockReset();
    trackedList.mockReset();
    trackedCount.mockReset();
    trackedInsert.mockReset();
    trackedDelete.mockReset();
  });

  it("401 when no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await POST(postReq({ ticker: "AAPL" }))).status).toBe(401);
    expect((await GET()).status).toBe(401);
    expect((await DELETE(delReq("?ticker=AAPL"))).status).toBe(401);
  });

  it("400 on an invalid ticker", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await POST(postReq({ ticker: "not a ticker!" }));
    expect(res.status).toBe(400);
  });

  it("403 pro_only for free tier", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "free" } });
    const res = await POST(postReq({ ticker: "AAPL" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("pro_only");
  });

  it("402 watchlist_limit when a Pro user is at 50", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    trackedCount.mockResolvedValue({ count: 50, error: null });
    const res = await POST(postReq({ ticker: "AAPL" }));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("watchlist_limit");
  });

  it("201 adds a ticker for a Pro user under the cap", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    trackedCount.mockResolvedValue({ count: 3, error: null });
    trackedInsert.mockResolvedValue({
      data: { id: "t1", ticker: "AAPL", added_at: "2026-06-12T00:00:00Z" },
      error: null,
    });
    const res = await POST(postReq({ ticker: "aapl" }));
    expect(res.status).toBe(201);
    expect((await res.json()).data.ticker).toBe("AAPL");
  });

  it("Premium is uncapped (no count query)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "premium" } });
    trackedInsert.mockResolvedValue({ data: { id: "t2", ticker: "MSFT", added_at: "x" }, error: null });
    const res = await POST(postReq({ ticker: "MSFT" }));
    expect(res.status).toBe(201);
    expect(trackedCount).not.toHaveBeenCalled();
  });

  it("409 when the ticker is already tracked", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    trackedCount.mockResolvedValue({ count: 1, error: null });
    trackedInsert.mockResolvedValue({ data: null, error: { code: "23505" } });
    const res = await POST(postReq({ ticker: "AAPL" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("duplicate");
  });

  it("GET lists tracked rows", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    trackedList.mockResolvedValue({
      data: [{ id: "t1", ticker: "AAPL", added_at: "x" }],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  it("DELETE 400 without a ticker", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    expect((await DELETE(delReq(""))).status).toBe(400);
  });

  it("DELETE 200 removes a ticker", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    trackedDelete.mockResolvedValue({ error: null });
    const res = await DELETE(delReq("?ticker=AAPL"));
    expect(res.status).toBe(200);
  });
});

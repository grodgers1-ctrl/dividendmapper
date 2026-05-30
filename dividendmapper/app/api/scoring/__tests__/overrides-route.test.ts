import { describe, it, expect, beforeEach, vi } from "vitest";

const upsertMock = vi.fn();
const deleteMatchMock = vi.fn();
const getClaimsMock = vi.fn();

const fromMock = vi.fn(() => ({
  upsert: upsertMock,
  delete: vi.fn(() => ({ match: deleteMatchMock })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: fromMock,
    auth: { getClaims: getClaimsMock },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-123" } } });
  upsertMock.mockResolvedValue({ error: null });
  deleteMatchMock.mockResolvedValue({ error: null });
});

function postReq(body: unknown): Request {
  return new Request("https://example.com/api/scoring/overrides", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function deleteReq(body: unknown): Request {
  return new Request("https://example.com/api/scoring/overrides", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
}

describe("POST /api/scoring/overrides", () => {
  it("upserts a 90-day override for the signed-in user", async () => {
    const { POST } = await import("../overrides/route");
    const res = await POST(postReq({ ticker: "PEP", scoreType: "buy" }));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("score_overrides");
    const [row, opts] = upsertMock.mock.calls[0];
    expect(row.user_id).toBe("user-123");
    expect(row.ticker).toBe("PEP");
    expect(row.score_type).toBe("buy");
    expect(opts).toMatchObject({ onConflict: "user_id,ticker,score_type" });
    // expires_at ~ 90 days out
    const days = (new Date(row.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
  });

  it("uppercases the ticker", async () => {
    const { POST } = await import("../overrides/route");
    await POST(postReq({ ticker: "pep", scoreType: "risk" }));
    expect(upsertMock.mock.calls[0][0].ticker).toBe("PEP");
  });

  it("returns 401 when unauthed", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });
    const { POST } = await import("../overrides/route");
    const res = await POST(postReq({ ticker: "PEP", scoreType: "buy" }));
    expect(res.status).toBe(401);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid scoreType", async () => {
    const { POST } = await import("../overrides/route");
    const res = await POST(postReq({ ticker: "PEP", scoreType: "sell" }));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed ticker", async () => {
    const { POST } = await import("../overrides/route");
    const res = await POST(postReq({ ticker: "../x", scoreType: "buy" }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/scoring/overrides", () => {
  it("clears the override for the signed-in user", async () => {
    const { DELETE } = await import("../overrides/route");
    const res = await DELETE(deleteReq({ ticker: "PEP", scoreType: "buy" }));
    expect(res.status).toBe(200);
    expect(deleteMatchMock).toHaveBeenCalledWith({
      user_id: "user-123",
      ticker: "PEP",
      score_type: "buy",
    });
  });

  it("returns 401 when unauthed", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });
    const { DELETE } = await import("../overrides/route");
    const res = await DELETE(deleteReq({ ticker: "PEP", scoreType: "buy" }));
    expect(res.status).toBe(401);
    expect(deleteMatchMock).not.toHaveBeenCalled();
  });
});

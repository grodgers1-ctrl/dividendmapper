import { describe, it, expect, beforeEach, vi } from "vitest";

const insertMock = vi.fn();
const getClaimsMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: fromMock,
    auth: { getClaims: getClaimsMock },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-123" } } });
  insertMock.mockResolvedValue({ error: null });
});

function postReq(body: unknown): Request {
  return new Request("https://example.com/api/reinvest/log", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validAccept = {
  triggerHoldingId: "11111111-1111-1111-1111-111111111111",
  triggerExDivDate: "2026-06-04",
  suggestedTickers: ["PEP", "PYPL", "MSFT"],
  userAction: "accepted",
  userActionTicker: "pep",
};

describe("POST /api/reinvest/log", () => {
  it("logs an accepted suggestion with the chosen ticker + acted_at", async () => {
    const { POST } = await import("../log/route");
    const res = await POST(postReq(validAccept));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("reinvest_suggestions_log");
    const row = insertMock.mock.calls[0][0];
    expect(row.user_id).toBe("user-123");
    expect(row.trigger_holding_id).toBe(validAccept.triggerHoldingId);
    expect(row.trigger_ex_div_date).toBe("2026-06-04");
    expect(row.suggested_tickers).toEqual(["PEP", "PYPL", "MSFT"]);
    expect(row.user_action).toBe("accepted");
    expect(row.user_action_ticker).toBe("PEP");
    expect(row.acted_at).toBeTruthy();
  });

  it("logs a shown_only event with null action ticker and null acted_at", async () => {
    const { POST } = await import("../log/route");
    const res = await POST(
      postReq({ ...validAccept, userAction: "shown_only", userActionTicker: undefined }),
    );
    expect(res.status).toBe(200);
    const row = insertMock.mock.calls[0][0];
    expect(row.user_action).toBe("shown_only");
    expect(row.user_action_ticker).toBeNull();
    expect(row.acted_at).toBeNull();
  });

  it("does not attach a ticker on a dismissed event", async () => {
    const { POST } = await import("../log/route");
    await POST(postReq({ ...validAccept, userAction: "dismissed" }));
    const row = insertMock.mock.calls[0][0];
    expect(row.user_action).toBe("dismissed");
    expect(row.user_action_ticker).toBeNull();
    expect(row.acted_at).toBeTruthy();
  });

  it("returns 401 when unauthed", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });
    const { POST } = await import("../log/route");
    const res = await POST(postReq(validAccept));
    expect(res.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid userAction", async () => {
    const { POST } = await import("../log/route");
    const res = await POST(postReq({ ...validAccept, userAction: "bought" }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 when suggestedTickers is empty or not a string array", async () => {
    const { POST } = await import("../log/route");
    expect((await POST(postReq({ ...validAccept, suggestedTickers: [] }))).status).toBe(400);
    expect((await POST(postReq({ ...validAccept, suggestedTickers: "PEP" }))).status).toBe(400);
  });

  it("returns 400 on a malformed ex-div date", async () => {
    const { POST } = await import("../log/route");
    const res = await POST(postReq({ ...validAccept, triggerExDivDate: "06/04/2026" }));
    expect(res.status).toBe(400);
  });
});

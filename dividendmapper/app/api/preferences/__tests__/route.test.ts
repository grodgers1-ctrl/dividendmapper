import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const maybeSingle = vi.fn();
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: () => ({
      upsert: (...a: unknown[]) => {
        upsert(...a);
        return { error: null };
      },
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}));

import { GET, PUT } from "../route";

function req(body: unknown) {
  return new Request("http://x/api/preferences", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("/api/preferences", () => {
  beforeEach(() => {
    upsert.mockReset();
    getClaims.mockReset();
    maybeSingle.mockReset();
  });

  it("401 when no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const res = await PUT(req({ primary_goal: "income_now" }));
    expect(res.status).toBe(401);
  });

  it("400 on an invalid enum value", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ primary_goal: "get_rich_quick" }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts valid answers and stamps completion", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(
      req({ primary_goal: "income_now", risk_appetite: "cautious", action: "complete" }),
    );
    expect(res.status).toBe(200);
    const row = upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row.primary_goal).toBe("income_now");
    expect(row.wizard_completed_at).toBeTypeOf("string");
  });

  it("GET returns the row", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    maybeSingle.mockResolvedValue({ data: { primary_goal: "income_now" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ primary_goal: "income_now" });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const getClaims = vi.fn();
const profileTier = vi.fn();
const connLookup = vi.fn();
const runBrokerSync = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => profileTier() }) }) };
      }
      // broker_connections: .select().eq(user_id).eq(id).maybeSingle()
      return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => connLookup() }) }) }) };
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({}) }),
}));

vi.mock("@/lib/brokers/run-sync", () => ({
  runBrokerSync: (...a: unknown[]) => runBrokerSync(...a),
}));

import { POST } from "../route";

function req(body?: unknown) {
  return new Request("http://x/api/portfolio/broker/sync", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
});

describe("POST /api/portfolio/broker/sync", () => {
  it("401 with no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await POST(req({ connectionId: "c1" }))).status).toBe(401);
  });

  it("403 for a Free user", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "free" } });
    expect((await POST(req({ connectionId: "c1" }))).status).toBe(403);
  });

  it("400 when no connectionId is given", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    expect((await POST(req({}))).status).toBe(400);
  });

  it("404 when the connection isn't the user's", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    connLookup.mockResolvedValue({ data: null });
    expect((await POST(req({ connectionId: "nope" }))).status).toBe(404);
  });

  it("syncs the targeted connection", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    connLookup.mockResolvedValue({ data: { id: "c1", status: "active", wrapper: "gia" } });
    runBrokerSync.mockResolvedValue({
      ok: true,
      positionCount: 2,
      dividendCount: 1,
      inserted: 1,
      updated: 1,
      archived: 0,
    });
    const res = await POST(req({ connectionId: "c1" }));
    expect(res.status).toBe(200);
    const arg = runBrokerSync.mock.calls[0][0] as { connection: { id: string; user_id: string; wrapper: string } };
    expect(arg.connection.id).toBe("c1");
    expect(arg.connection.user_id).toBe("u1");
    expect(arg.connection.wrapper).toBe("gia");
  });
});

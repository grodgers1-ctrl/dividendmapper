import { describe, it, expect, vi, beforeEach } from "vitest";

const getClaims = vi.fn();
const profileTier = vi.fn();
const connLookup = vi.fn(); // server-side broker_connections lookup (DELETE)

// admin (service-role) spies
const upsertConn = vi.fn();
const connUpsertResult = vi.fn();
const credUpsert = vi.fn();
const updateConn = vi.fn();
const updateConnEq = vi.fn();
const credDelete = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => profileTier() }) }) };
      }
      // broker_connections ownership lookup for DELETE: .eq(user_id).eq(id).maybeSingle()
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => connLookup() }) }) }),
      };
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "broker_credentials") {
        return {
          upsert: (...a: unknown[]) => {
            credUpsert(...a);
            return Promise.resolve({ error: null });
          },
          delete: () => ({
            eq: (...a: unknown[]) => {
              credDelete(...a);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      // broker_connections
      return {
        upsert: (obj: unknown, opts: unknown) => {
          upsertConn(obj, opts);
          return { select: () => ({ single: () => connUpsertResult() }) };
        },
        update: (obj: unknown) => {
          updateConn(obj);
          return {
            eq: (...a: unknown[]) => {
              updateConnEq(...a);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  }),
}));

vi.mock("@/lib/brokers/t212/client", () => ({
  createT212Client: () => ({ fetchPortfolio: vi.fn().mockResolvedValue([]) }),
}));

vi.mock("@/lib/brokers/crypto", () => ({
  encryptCredential: () => "cipher",
}));

import { POST, DELETE } from "../route";

function postReq(body: unknown) {
  return new Request("http://x/api/portfolio/broker/connect", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function delReq(body?: unknown) {
  return new Request("http://x/api/portfolio/broker/connect", {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
});

describe("POST /api/portfolio/broker/connect", () => {
  it("401 with no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await POST(postReq({ apiKey: "k", apiSecret: "s", wrapper: "isa" }))).status).toBe(401);
  });

  it("403 for a Free user", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "free" } });
    const res = await POST(postReq({ apiKey: "k", apiSecret: "s", wrapper: "isa" }));
    expect(res.status).toBe(403);
  });

  it("upserts the connection keyed by (user_id, provider, wrapper) so a 2nd wrapper is a new row", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    profileTier.mockResolvedValue({ data: { tier: "pro" } });
    connUpsertResult.mockResolvedValue({ data: { id: "c1" }, error: null });
    const res = await POST(postReq({ apiKey: "k", apiSecret: "s", wrapper: "gia" }));
    expect(res.status).toBe(201);
    const [obj, opts] = upsertConn.mock.calls[0];
    expect((obj as { wrapper: string }).wrapper).toBe("gia");
    expect((opts as { onConflict: string }).onConflict).toBe("user_id,provider,wrapper");
  });
});

describe("DELETE /api/portfolio/broker/connect", () => {
  it("401 with no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await DELETE(delReq({ connectionId: "c1" }))).status).toBe(401);
  });

  it("400 when no connectionId is given", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    expect((await DELETE(delReq({}))).status).toBe(400);
  });

  it("404 when the connection isn't the user's", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    connLookup.mockResolvedValue({ data: null });
    expect((await DELETE(delReq({ connectionId: "nope" }))).status).toBe(404);
  });

  it("revokes only the targeted connection", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    connLookup.mockResolvedValue({ data: { id: "c1" } });
    const res = await DELETE(delReq({ connectionId: "c1" }));
    expect(res.status).toBe(200);
    expect(credDelete).toHaveBeenCalledWith("connection_id", "c1");
    expect(updateConn).toHaveBeenCalledWith(expect.objectContaining({ status: "revoked" }));
    expect(updateConnEq).toHaveBeenCalledWith("id", "c1");
  });
});

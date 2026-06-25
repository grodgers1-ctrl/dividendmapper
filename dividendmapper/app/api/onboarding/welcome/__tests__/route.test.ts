import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const getClaimsMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: getClaimsMock },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (row: unknown, opts: unknown) => {
        upsertMock(row, opts);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub";
});

describe("POST /api/onboarding/welcome", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: { message: "nope" } });
    const res = await POST(
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "completed" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unknown reason values with 400", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const res = await POST(
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "lol" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts the dismissals row with the supplied reason", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const res = await POST(
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "completed" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", reason: "completed" }),
      expect.objectContaining({ onConflict: "user_id" }),
    );
  });

  it("is idempotent (second call resolves the same upsert without error)", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const req = () =>
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "dismissed" }),
      });
    const r1 = await POST(req());
    const r2 = await POST(req());
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });
});

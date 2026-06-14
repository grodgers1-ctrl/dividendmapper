import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const getClaims = vi.fn();
const selectRows = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: () => ({
      upsert: (...a: unknown[]) => {
        upsert(...a);
        return { error: null };
      },
      select: () => ({ eq: () => selectRows() }),
    }),
  }),
}));

import { GET, PUT } from "../route";

function req(body: unknown) {
  return new Request("http://x/api/notifications", { method: "PUT", body: JSON.stringify(body) });
}

describe("/api/notifications", () => {
  beforeEach(() => {
    upsert.mockReset();
    getClaims.mockReset();
    selectRows.mockReset();
  });

  it("401 when no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await PUT(req({}))).status).toBe(401);
  });

  it("400 on an out-of-range threshold", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ risk: { enabled: true, threshold: 150 } }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts a Risk pref row keyed by event_type", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ risk: { enabled: true, threshold: 80 } }));
    expect(res.status).toBe(200);
    const rows = upsert.mock.calls[0][0] as Record<string, unknown>[];
    const risk = rows.find((r) => r.event_type === "risk_threshold_crossed")!;
    expect(risk.user_id).toBe("u1");
    expect(risk.enabled).toBe(true);
    expect(risk.threshold_value).toBe(80);
  });

  it("GET shapes rows into { quality, risk, watchlist }", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({
      data: [
        { event_type: "buy_threshold_crossed", enabled: true, threshold_value: 30 },
        { event_type: "risk_threshold_crossed", enabled: false, threshold_value: 75 },
        { event_type: "watchlist_alert", enabled: true, threshold_value: null },
      ],
    });
    const res = await GET();
    expect(await res.json()).toEqual({
      quality: { enabled: true, threshold: 30 },
      risk: { enabled: false, threshold: 75 },
      watchlist: { enabled: true },
      weeklyDigest: { enabled: false },
    });
  });

  it("GET defaults watchlist to disabled when no row exists", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({ data: [] });
    const res = await GET();
    expect((await res.json()).watchlist).toEqual({ enabled: false });
  });

  it("upserts a watchlist_alert row (on/off, no threshold)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ watchlist: { enabled: true } }));
    expect(res.status).toBe(200);
    const rows = upsert.mock.calls[0][0] as Record<string, unknown>[];
    const wl = rows.find((r) => r.event_type === "watchlist_alert")!;
    expect(wl.user_id).toBe("u1");
    expect(wl.enabled).toBe(true);
    expect(wl.threshold_value).toBeNull();
  });

  it("400 on a malformed watchlist pref", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ watchlist: { enabled: "yes" } }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("GET defaults weeklyDigest to disabled when no row exists", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({ data: [] });
    const res = await GET();
    expect((await res.json()).weeklyDigest).toEqual({ enabled: false });
  });

  it("GET reflects an enabled weekly_digest row", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({
      data: [{ event_type: "weekly_digest", enabled: true, threshold_value: null }],
    });
    const res = await GET();
    expect((await res.json()).weeklyDigest).toEqual({ enabled: true });
  });

  it("upserts a weekly_digest row (on/off, no threshold)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ weeklyDigest: { enabled: true } }));
    expect(res.status).toBe(200);
    const rows = upsert.mock.calls[0][0] as Record<string, unknown>[];
    const weekly = rows.find((r) => r.event_type === "weekly_digest")!;
    expect(weekly.user_id).toBe("u1");
    expect(weekly.enabled).toBe(true);
    expect(weekly.threshold_value).toBeNull();
  });

  it("400 on a malformed weeklyDigest pref", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ weeklyDigest: { enabled: "yes" } }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});

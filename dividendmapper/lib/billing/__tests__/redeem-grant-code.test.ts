import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const captureSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: (...a: unknown[]) => captureSpy(...a),
}));

const notifyFoundersSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/founder/notify", () => ({
  notifyFounders: (...a: unknown[]) => notifyFoundersSpy(...a),
}));

import { redeemGrantCode } from "../redeem-grant-code";

// ---------------------------------------------------------------------------
// Fake service-role supabase client.
//
// redeemGrantCode makes exactly these calls, in order:
//   1. from("grant_codes").select(...).eq("code", normalized).maybeSingle()
//   2. from("grant_redemptions").select(...).eq("redeemed_by_user_id", userId).limit(1)
//   3. supabase.rpc("redeem_grant_code", { p_code, p_user_id })
//
// The builder returned by from() is a thenable-free chain that resolves via the
// terminal maybeSingle()/limit() methods, matching the supabase-js surface the
// code touches.
// ---------------------------------------------------------------------------

interface GrantCodeRow {
  id: string;
  code: string;
  issuer_user_id: string | null;
  grants_days: number;
  grants_tier: string;
}

type FakeConfig = {
  grantCodeRow?: GrantCodeRow | null;
  grantCodeError?: { message: string } | null;
  existingRedemption?: unknown | null;
  redemptionSelectError?: { message: string } | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
};

function makeSupabase(cfg: FakeConfig) {
  const rpcSpy = vi.fn().mockResolvedValue({
    data: cfg.rpcData ?? null,
    error: cfg.rpcError ?? null,
  });

  const from = vi.fn((table: string) => {
    if (table === "grant_codes") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: cfg.grantCodeRow ?? null,
                error: cfg.grantCodeError ?? null,
              }),
          }),
        }),
      };
    }
    if (table === "grant_redemptions") {
      return {
        select: () => ({
          eq: () => ({
            limit: () =>
              Promise.resolve({
                data:
                  cfg.existingRedemption == null
                    ? []
                    : [cfg.existingRedemption],
                error: cfg.redemptionSelectError ?? null,
              }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { from, rpc: rpcSpy, rpcSpy } as never;
}

const USER_ID = "user-1";
const CODE = "GLENN-3K7QPA";

const validRow: GrantCodeRow = {
  id: "gc-1",
  code: CODE,
  issuer_user_id: "issuer-9",
  grants_days: 7,
  grants_tier: "pro",
};

beforeEach(() => {
  captureSpy.mockClear();
  notifyFoundersSpy.mockClear();
});

describe("redeemGrantCode — app-layer pre-checks", () => {
  it("returns not_found when the grant_codes row is missing", async () => {
    const supabase = makeSupabase({ grantCodeRow: null });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("returns not_found when the grant_codes select errors", async () => {
    const supabase = makeSupabase({
      grantCodeRow: null,
      grantCodeError: { message: "boom" },
    });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns self_redemption when issuer === redeemer", async () => {
    const supabase = makeSupabase({
      grantCodeRow: { ...validRow, issuer_user_id: USER_ID },
    });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: false, reason: "self_redemption" });
    expect((supabase as unknown as { rpcSpy: ReturnType<typeof vi.fn> }).rpcSpy).not.toHaveBeenCalled();
  });

  it("returns already_redeemed when the user has any prior redemption (one trial ever)", async () => {
    const supabase = makeSupabase({
      grantCodeRow: validRow,
      existingRedemption: { id: "r-old" },
    });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: false, reason: "already_redeemed" });
    expect((supabase as unknown as { rpcSpy: ReturnType<typeof vi.fn> }).rpcSpy).not.toHaveBeenCalled();
  });

  it("normalizes the code to uppercase before matching", async () => {
    const supabase = makeSupabase({
      grantCodeRow: validRow,
      rpcData: [{ tier_expires_at: "2026-07-08T00:00:00Z" }],
    });
    await redeemGrantCode(supabase, { userId: USER_ID, code: "  glenn-3k7qpa  " });
    const rpcArgs = (supabase as unknown as { rpcSpy: ReturnType<typeof vi.fn> }).rpcSpy.mock.calls[0];
    expect(rpcArgs[0]).toBe("redeem_grant_code");
    expect(rpcArgs[1]).toEqual({ p_code: CODE, p_user_id: USER_ID });
  });
});

describe("redeemGrantCode — RPC error mapping", () => {
  const cases: Array<[string, string]> = [
    ["grant_code_not_found", "not_found"],
    ["grant_code_expired", "expired"],
    ["grant_code_exhausted", "exhausted"],
    ["grant_code_already_redeemed", "already_redeemed"],
    ["profile_ineligible_tier", "ineligible_tier"],
    ["profile_not_found", "error"],
    ["some totally unexpected postgres error", "error"],
  ];

  for (const [message, reason] of cases) {
    it(`maps RPC error "${message}" → ${reason}`, async () => {
      const supabase = makeSupabase({
        grantCodeRow: validRow,
        rpcError: { message },
      });
      const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
      expect(result).toEqual({ ok: false, reason });
      expect(captureSpy).not.toHaveBeenCalled();
      expect(notifyFoundersSpy).not.toHaveBeenCalled();
    });
  }
});

describe("redeemGrantCode — happy path", () => {
  it("returns ok + tierExpiresAt and fires analytics + founder ping (array shape)", async () => {
    const supabase = makeSupabase({
      grantCodeRow: validRow,
      rpcData: [{ tier_expires_at: "2026-07-08T00:00:00Z" }],
    });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: true, tierExpiresAt: "2026-07-08T00:00:00Z" });

    expect(captureSpy).toHaveBeenCalledWith(USER_ID, "trial_started", {
      code: CODE,
      grants_days: 7,
      issuer_user_id: "issuer-9",
    });
    expect(notifyFoundersSpy).toHaveBeenCalledTimes(1);
    const notifyArgs = notifyFoundersSpy.mock.calls[0][1];
    expect(notifyArgs.sendKey).toContain(USER_ID);
  });

  it("reads the expiry defensively when the RPC returns a single object (not an array)", async () => {
    const supabase = makeSupabase({
      grantCodeRow: validRow,
      rpcData: { tier_expires_at: "2026-07-08T00:00:00Z" },
    });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: true, tierExpiresAt: "2026-07-08T00:00:00Z" });
  });

  it("returns error when the RPC succeeds but no expiry comes back", async () => {
    const supabase = makeSupabase({ grantCodeRow: validRow, rpcData: [] });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("still returns ok when analytics / founder ping throw (non-fatal)", async () => {
    captureSpy.mockRejectedValueOnce(new Error("posthog down"));
    notifyFoundersSpy.mockRejectedValueOnce(new Error("resend down"));
    const supabase = makeSupabase({
      grantCodeRow: validRow,
      rpcData: [{ tier_expires_at: "2026-07-08T00:00:00Z" }],
    });
    const result = await redeemGrantCode(supabase, { userId: USER_ID, code: CODE });
    expect(result).toEqual({ ok: true, tierExpiresAt: "2026-07-08T00:00:00Z" });
  });
});

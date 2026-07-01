import { describe, it, expect, vi, beforeEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

const captureServerEvent = vi.fn();
vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...a),
}));

// Capture the props rather than render, so we can assert on what's fed in.
vi.mock("@/emails/trial-expired", () => ({ TrialExpiredEmail: (props: unknown) => ({ props }) }));

const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

// Build a profiles-only supabase mock.
//  - selectData: rows returned by the "expired trials" SELECT
//    (.select().eq().lt()).
//  - updateRows: rows the re-guarded UPDATE (.update().eq().eq().select())
//    reports as affected. [] models the Stripe-conversion race (0 rows matched).
//  - updateError: optional error surfaced by the UPDATE.
function makeSupabase(opts: {
  selectData: Array<{ id: string; email: string | null; tier_expires_at: string | null }>;
  updateRows?: Array<{ id: string }>;
  updateError?: unknown;
}) {
  const update = vi.fn().mockReturnValue({
    eq: () => ({
      eq: () => ({
        select: () =>
          Promise.resolve({
            data: opts.updateError ? null : (opts.updateRows ?? [{ id: "x" }]),
            error: opts.updateError ?? null,
          }),
      }),
    }),
  });
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            lt: () => Promise.resolve({ data: opts.selectData, error: null }),
          }),
        }),
        update,
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from, update };
}

function makeReq(auth = "Bearer test-secret") {
  return new Request("https://x/api/internal/expire-trials", { headers: { authorization: auth } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dividendmapper.com";
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
});

describe("expire-trials route", () => {
  it("rejects a missing/bad bearer token", async () => {
    createClient.mockReturnValue(makeSupabase({ selectData: [] }));
    const { GET } = await import("../route");
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("downgrades an expired trial, emails once, and counts it", async () => {
    const sb = makeSupabase({
      selectData: [{ id: "u1", email: "a@b.com", tier_expires_at: "2020-01-01T00:00:00Z" }],
      updateRows: [{ id: "u1" }],
    });
    createClient.mockReturnValue(sb);
    const { GET } = await import("../route");
    const res = await GET(makeReq());

    expect(await res.json()).toEqual({ ok: true, expired: 1 });
    expect(sb.update).toHaveBeenCalledWith({ tier: "free", tier_source: "free", tier_expires_at: null });
    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const call = sendIdempotent.mock.calls[0][0];
    expect(call.sendKey).toBe("trial_expired_u1");
    expect(call.template).toBe("trial_expired");
    expect(call.body.props).toEqual({ pricingUrl: "https://dividendmapper.com/pricing" });
    expect(captureServerEvent).toHaveBeenCalledWith("u1", "trial_expired", {});
  });

  it("skips the email and count when the re-guarded UPDATE matches 0 rows (Stripe race)", async () => {
    // User converted to a real Stripe subscription between SELECT and UPDATE:
    // the .eq('tier_source','trial') re-guard now matches nothing.
    const sb = makeSupabase({
      selectData: [{ id: "u1", email: "a@b.com", tier_expires_at: "2020-01-01T00:00:00Z" }],
      updateRows: [],
    });
    createClient.mockReturnValue(sb);
    const { GET } = await import("../route");
    const res = await GET(makeReq());

    expect(await res.json()).toEqual({ ok: true, expired: 0 });
    expect(sendIdempotent).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("skips a profile with no email", async () => {
    const sb = makeSupabase({
      selectData: [{ id: "u1", email: null, tier_expires_at: "2020-01-01T00:00:00Z" }],
    });
    createClient.mockReturnValue(sb);
    const { GET } = await import("../route");
    const res = await GET(makeReq());

    expect(await res.json()).toEqual({ ok: true, expired: 0 });
    expect(sb.update).not.toHaveBeenCalled();
    expect(sendIdempotent).not.toHaveBeenCalled();
  });

  it("routes a failed email send to Sentry but still counts the downgrade", async () => {
    const sb = makeSupabase({
      selectData: [{ id: "u1", email: "a@b.com", tier_expires_at: "2020-01-01T00:00:00Z" }],
      updateRows: [{ id: "u1" }],
    });
    createClient.mockReturnValue(sb);
    sendIdempotent.mockResolvedValue({ ok: false, reason: "resend_error", error: new Error("boom") });
    const { GET } = await import("../route");
    const res = await GET(makeReq());

    // Downgrade already happened, so the user is still counted as expired.
    expect(await res.json()).toEqual({ ok: true, expired: 1 });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toEqual({
      extra: { userId: "u1", sendReason: "resend_error" },
    });
  });

  it("does not report already_sent to Sentry (idempotent no-op)", async () => {
    const sb = makeSupabase({
      selectData: [{ id: "u1", email: "a@b.com", tier_expires_at: "2020-01-01T00:00:00Z" }],
      updateRows: [{ id: "u1" }],
    });
    createClient.mockReturnValue(sb);
    sendIdempotent.mockResolvedValue({ ok: false, reason: "already_sent" });
    const { GET } = await import("../route");
    const res = await GET(makeReq());

    expect(await res.json()).toEqual({ ok: true, expired: 1 });
    expect(captureException).not.toHaveBeenCalled();
  });
});

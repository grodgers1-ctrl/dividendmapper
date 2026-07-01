import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendIdempotent(...a),
}));

const issueReferralCodeForUser = vi.fn();
vi.mock("@/lib/billing/issue-referral-code", () => ({
  issueReferralCodeForUser: (...a: unknown[]) => issueReferralCodeForUser(...a),
}));

// Capture props rather than render, so route tests stay independent of the
// email template.
vi.mock("@/emails/pro-referral-offer", () => ({
  ProReferralOfferEmail: (props: unknown) => ({ props }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...a: unknown[]) => createClient(...a),
}));

const FIXED_NOW = new Date("2026-07-01T12:00:00Z");
const DAY_MS = 24 * 3600 * 1000;
// u1 became Pro 30 days ago (due), u2 became Pro 10 days ago (not due).
const DUE_CREATED = new Date(FIXED_NOW.getTime() - 30 * DAY_MS).toISOString();
const EARLY_CREATED = new Date(FIXED_NOW.getTime() - 10 * DAY_MS).toISOString();

// Two-query cohort: active subscriptions, then profiles by id.
//   u1 = paying Pro (stripe), 30 days ago  -> DUE, should send
//   u2 = paying Pro (stripe), 10 days ago  -> under the 21-day gate, no send
//   u3 = founding member, 30 days ago      -> excluded by tier_source filter
//   u4 = trial user, 30 days ago           -> excluded by tier_source filter
// u3 and u4 both have an active subscription AND a due created_at, so they clear
// the no-subscription guard and the time gate. The ONLY thing dropping them is
// the tier_source==='stripe' eligibility filter — so if that filter were
// removed, u3/u4 would send and the assertions below would fail. sent_emails
// has no prior row for anyone.
function makeSupabase() {
  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { user_id: "u1", created_at: DUE_CREATED },
                { user_id: "u2", created_at: EARLY_CREATED },
                // u3/u4 are due on time and DO have an active subscription, so
                // they pass the no-subscription guard and the time gate. Only
                // the tier_source filter drops them.
                { user_id: "u3", created_at: DUE_CREATED },
                { user_id: "u4", created_at: DUE_CREATED },
              ],
              error: null,
            }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                { id: "u1", email: "due@b.com", tier: "pro", tier_source: "stripe" },
                { id: "u2", email: "early@b.com", tier: "pro", tier_source: "stripe" },
                // Founding member: due on time, but tier_source excludes it.
                { id: "u3", email: "founder@b.com", tier: "pro", tier_source: "founding_member" },
                // Trial user: due on time, but tier_source excludes it.
                { id: "u4", email: "trial@b.com", tier: "pro", tier_source: "trial" },
              ],
              error: null,
            }),
        }),
      };
    }
    if (table === "sent_emails") {
      return {
        select: () => ({
          eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from };
}

function makeReq(auth = "Bearer test-secret") {
  return new Request("https://x/api/internal/send-pro-referral-emails", {
    headers: { authorization: auth },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dividendmapper.com";
  issueReferralCodeForUser.mockResolvedValue({ code: "CODE-1", alreadyIssued: false });
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("send-pro-referral-emails route", () => {
  it("rejects a missing/bad bearer token", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("sends only to the due stripe-Pro user; excludes founding member and trial", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json).toEqual({ ok: true, sent: 1 });

    // Only u1 (due, tier_source='stripe') got a code minted and an email. u3
    // (founding member) and u4 (trial) are due on time but blocked by the
    // tier_source filter; u2 is stripe-Pro but under the 21-day gate.
    expect(issueReferralCodeForUser).toHaveBeenCalledTimes(1);
    expect(issueReferralCodeForUser.mock.calls[0][1]).toEqual({
      userId: "u1",
      email: "due@b.com",
    });

    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const call = sendIdempotent.mock.calls[0][0];
    expect(call.to).toBe("due@b.com");
    expect(call.sendKey).toBe("pro_referral_offer_u1");
    expect(call.template).toBe("pro_referral_offer");
    expect(call.body.props).toEqual({
      code: "CODE-1",
      referralUrl: "https://dividendmapper.com/refer/CODE-1",
      accountUrl: "https://dividendmapper.com/app/account",
    });

    // Guard against the exclusion regressing: the founding member and trial
    // emails must never be issued a code or sent to.
    const sentTo = sendIdempotent.mock.calls.map((c) => c[0].to);
    expect(sentTo).not.toContain("founder@b.com");
    expect(sentTo).not.toContain("trial@b.com");
  });
});

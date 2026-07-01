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

// Two-query cohort: active subscriptions, then profiles by id. Both users are
// paying Pro (tier='pro', tier_source='stripe'); the founding member u3 is
// filtered out in JS. sent_emails has no prior row for anyone.
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
                // Founding member with a stray active subscription -> excluded.
                { id: "u3", email: "founder@b.com", tier: "pro", tier_source: "founding_member" },
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

  it("sends to the due user only, and issues a code just for them", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json).toEqual({ ok: true, sent: 1 });

    // Only the due user got a code minted and an email.
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
  });
});

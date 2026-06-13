import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const sendIdempotentSpy = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendIdempotentSpy(...a),
}));

const captureSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: (...a: unknown[]) => captureSpy(...a),
}));

const generateProCodeSpy = vi
  .fn()
  .mockResolvedValue({ promoCodeId: "promo_123", code: "DM60-AB12CD" });
vi.mock("../pro-code", () => ({
  generateLifecycleProCode: (...a: unknown[]) => generateProCodeSpy(...a),
}));

import { dispatchLifecycleStep } from "../dispatcher";
import type { LifecycleContext } from "../build-context";

const fakeSupabase = {} as never;

const baseUser = {
  userId: "u1",
  email: "u1@x",
  tier: "free" as const,
  createdAt: "2026-04-13T00:00:00Z",
  lastSignInAt: "2026-06-12T00:00:00Z",
  lifecycleUnsubscribed: false,
};

const baseCtx: LifecycleContext = {
  userId: "u1",
  holdingsCount: 3,
  tier: "free",
  lifecycleUnsubscribed: false,
  lastSignInAtMs: Date.parse("2026-06-12T00:00:00Z"),
  nowMs: Date.parse("2026-06-13T00:00:00Z"),
  lowestScoringTicker: { ticker: "VOD.L", score: 22 },
  proPitchLines: [
    { ticker: "AAPL", action: "BUY", score: 78 },
    { ticker: "VOD.L", action: "TRIM", score: 22 },
  ],
  recentScoreMoves: [{ ticker: "AAPL", from: 70, to: 78 }],
  upcomingExDivs: [{ ticker: "VOD.L", exDate: "2026-07-04", payment: "10.5" }],
};

beforeEach(() => {
  sendIdempotentSpy.mockClear();
  generateProCodeSpy.mockClear();
  captureSpy.mockClear();
});

describe("dispatchLifecycleStep PostHog instrumentation", () => {
  it("emits lifecycle_email_sent after a successful welcome", async () => {
    await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "welcome_free",
      context: { ...baseCtx, holdingsCount: 0, lowestScoringTicker: null, proPitchLines: [] },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(captureSpy).toHaveBeenCalledWith(
      "u1",
      "lifecycle_email_sent",
      expect.objectContaining({ template: "welcome_free", days_after_signup: 0 }),
    );
  });

  it("does NOT emit lifecycle_email_sent when the dispatcher short-circuits", async () => {
    await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "score_explainer",
      context: { ...baseCtx, lowestScoringTicker: null },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(captureSpy).not.toHaveBeenCalled();
  });
});

describe("dispatchLifecycleStep (welcome + activation)", () => {
  it("sends welcome_free with the right send_key and subject", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "welcome_free",
      context: { ...baseCtx, holdingsCount: 0, lowestScoringTicker: null, proPitchLines: [] },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("welcome_free");
    expect(arg.sendKey).toBe("lifecycle_welcome_free_u1");
    expect(arg.subject).toBe("Welcome to DividendMapper");
    expect(arg.headers["List-Unsubscribe"]).toMatch(
      /^<https:\/\/dividendmapper.com\/api\/lifecycle\/unsubscribe\?token=[^>]+>$/,
    );
    expect(arg.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("sends activation_nudge with the right send_key", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "activation_nudge",
      context: { ...baseCtx, holdingsCount: 0, lowestScoringTicker: null, proPitchLines: [] },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("activation_nudge");
    expect(arg.sendKey).toBe("lifecycle_activation_nudge_u2".replace("u2", "u1"));
  });
});

describe("dispatchLifecycleStep (score_explainer)", () => {
  it("short-circuits when lowestScoringTicker is null", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "score_explainer",
      context: { ...baseCtx, lowestScoringTicker: null },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("no_data_yet");
    expect(sendIdempotentSpy).not.toHaveBeenCalled();
  });

  it("happy path threads the ticker through to the template", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "score_explainer",
      context: baseCtx,
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("score_explainer");
    expect(arg.sendKey).toBe("lifecycle_score_explainer_u1");
  });
});

describe("dispatchLifecycleStep (pro_pitch_1)", () => {
  it("short-circuits when fewer than 2 pitch lines", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_1",
      context: { ...baseCtx, proPitchLines: [baseCtx.proPitchLines[0]] },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("insufficient_data");
    expect(sendIdempotentSpy).not.toHaveBeenCalled();
  });

  it("happy path passes the lines through to the template", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_1",
      context: baseCtx,
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("pro_pitch_1");
    expect(arg.sendKey).toBe("lifecycle_pro_pitch_1_u1");
  });
});

describe("dispatchLifecycleStep (monthly_recap)", () => {
  it("short-circuits when both arrays are empty", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "monthly_recap",
      context: { ...baseCtx, recentScoreMoves: [], upcomingExDivs: [] },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("no_recap_content");
    expect(sendIdempotentSpy).not.toHaveBeenCalled();
  });

  it("happy path sends when only score moves exist", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "monthly_recap",
      context: { ...baseCtx, upcomingExDivs: [] },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    expect(sendIdempotentSpy.mock.calls[0][0].template).toBe("monthly_recap");
  });
});

describe("dispatchLifecycleStep (pro_pitch_final)", () => {
  beforeEach(() => {
    process.env.STRIPE_COUPON_LIFECYCLE_DAY60 = "lifecycle_day60_50off_first_month";
  });
  afterEach(() => {
    delete process.env.STRIPE_COUPON_LIFECYCLE_DAY60;
  });

  it("short-circuits when STRIPE_COUPON_LIFECYCLE_DAY60 is unset", async () => {
    delete process.env.STRIPE_COUPON_LIFECYCLE_DAY60;
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_final",
      context: baseCtx,
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("stripe_not_configured");
    expect(generateProCodeSpy).not.toHaveBeenCalled();
    expect(sendIdempotentSpy).not.toHaveBeenCalled();
  });

  it("happy path mints a code and sends with the right code in the body", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_final",
      context: baseCtx,
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    expect(generateProCodeSpy).toHaveBeenCalledWith({
      couponId: "lifecycle_day60_50off_first_month",
      nowMs: baseCtx.nowMs,
    });
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("pro_pitch_final");
    expect(arg.sendKey).toBe("lifecycle_pro_pitch_final_u1");
  });
});

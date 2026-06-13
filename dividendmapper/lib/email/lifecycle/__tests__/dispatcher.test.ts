import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendIdempotentSpy = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendIdempotentSpy(...a),
}));

import { dispatchLifecycleStep } from "../dispatcher";

const fakeSupabase = {} as never;

describe("dispatchLifecycleStep", () => {
  it("sends welcome_free with the right send_key and subject", async () => {
    sendIdempotentSpy.mockClear();
    const result = await dispatchLifecycleStep({
      user: {
        userId: "u1",
        email: "u1@x",
        tier: "free",
        createdAt: "2026-06-13T00:00:00Z",
        lastSignInAt: "2026-06-13T00:00:00Z",
        lifecycleUnsubscribed: false,
      },
      stepKey: "welcome_free",
      context: {
        userId: "u1",
        holdingsCount: 0,
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAtMs: Date.now(),
        nowMs: Date.now(),
        lowestScoringTicker: null,
      },
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
    sendIdempotentSpy.mockClear();
    const result = await dispatchLifecycleStep({
      user: {
        userId: "u2",
        email: "u2@x",
        tier: "free",
        createdAt: "2026-06-10T00:00:00Z",
        lastSignInAt: "2026-06-10T00:00:00Z",
        lifecycleUnsubscribed: false,
      },
      stepKey: "activation_nudge",
      context: {
        userId: "u2",
        holdingsCount: 0,
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAtMs: Date.now(),
        nowMs: Date.now(),
        lowestScoringTicker: null,
      },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("activation_nudge");
    expect(arg.sendKey).toBe("lifecycle_activation_nudge_u2");
  });

  it("returns ok=false for a step not yet wired", async () => {
    sendIdempotentSpy.mockClear();
    const result = await dispatchLifecycleStep({
      user: {
        userId: "u1",
        email: "u1@x",
        tier: "free",
        createdAt: "2026-06-13T00:00:00Z",
        lastSignInAt: "2026-06-13T00:00:00Z",
        lifecycleUnsubscribed: false,
      },
      stepKey: "score_explainer",
      context: {
        userId: "u1",
        holdingsCount: 3,
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAtMs: Date.now(),
        nowMs: Date.now(),
        lowestScoringTicker: { ticker: "VOD.L", score: 22 },
      },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect(sendIdempotentSpy).not.toHaveBeenCalled();
  });
});

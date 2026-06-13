import { describe, it, expect, vi } from "vitest";
import { runLifecycle } from "../run-lifecycle";
import type { LifecycleContext } from "../build-context";

describe("runLifecycle", () => {
  const baseUser = {
    userId: "u1",
    email: "u1@x",
    tier: "free" as const,
    createdAt: "2026-04-01T00:00:00Z",
    lastSignInAt: "2026-06-10T00:00:00Z",
    lifecycleUnsubscribed: false,
  };

  it("sends welcome_free on day 0 to a user who signed in", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
    const ctxFor = vi.fn().mockResolvedValue({
      userId: "u1",
      holdingsCount: 0,
      tier: "free",
      lifecycleUnsubscribed: false,
      lastSignInAtMs: Date.parse("2026-06-13T00:00:00Z"),
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      lowestScoringTicker: null,
    } satisfies LifecycleContext);

    const result = await runLifecycle({
      users: [
        {
          ...baseUser,
          createdAt: "2026-06-13T00:00:00Z",
          lastSignInAt: "2026-06-13T00:00:00Z",
        },
      ],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: ctxFor,
      sendStep: send,
      alreadySent: () => Promise.resolve(false),
    });

    expect(result.attempted).toBe(1);
    expect(result.sent).toBe(1);
    expect(send.mock.calls[0][0].stepKey).toBe("welcome_free");
  });

  it("does not send welcome_free if user never signed in", async () => {
    const send = vi.fn();
    const result = await runLifecycle({
      users: [{ ...baseUser, createdAt: "2026-06-13T00:00:00Z", lastSignInAt: null }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: vi.fn(),
      sendStep: send,
      alreadySent: () => Promise.resolve(false),
    });
    expect(result.attempted).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips a step whose gate returns true (activation_nudge with holdings)", async () => {
    const send = vi.fn();
    const result = await runLifecycle({
      users: [{ ...baseUser, createdAt: "2026-06-10T00:00:00Z" }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: () =>
        Promise.resolve({
          userId: "u1",
          holdingsCount: 5,
          tier: "free",
          lifecycleUnsubscribed: false,
          lastSignInAtMs: Date.parse("2026-06-13T00:00:00Z"),
          nowMs: Date.parse("2026-06-13T00:00:00Z"),
          lowestScoringTicker: null,
        }),
      sendStep: send,
      alreadySent: (uid, key) => Promise.resolve(key === "lifecycle_welcome_free_u1"),
    });
    expect(result.skipped).toBeGreaterThan(0);
    expect(send.mock.calls.find((c) => c[0].stepKey === "activation_nudge")).toBeUndefined();
  });

  it("does not re-send a step that's already in sent_emails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
    await runLifecycle({
      users: [{ ...baseUser, createdAt: "2026-06-13T00:00:00Z", lastSignInAt: "2026-06-13T00:00:00Z" }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: () =>
        Promise.resolve({
          userId: "u1",
          holdingsCount: 0,
          tier: "free",
          lifecycleUnsubscribed: false,
          lastSignInAtMs: Date.parse("2026-06-13T00:00:00Z"),
          nowMs: Date.parse("2026-06-13T00:00:00Z"),
          lowestScoringTicker: null,
        }),
      sendStep: send,
      alreadySent: (uid, key) => Promise.resolve(key === "lifecycle_welcome_free_u1"),
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("attempts every overdue step in one pass (catch-up after a missed day)", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
    const created = "2026-04-13T00:00:00Z";
    await runLifecycle({
      users: [{ ...baseUser, createdAt: created, lastSignInAt: "2026-04-13T00:00:00Z" }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: () =>
        Promise.resolve({
          userId: "u1",
          holdingsCount: 3,
          tier: "free",
          lifecycleUnsubscribed: false,
          lastSignInAtMs: Date.parse("2026-06-12T00:00:00Z"),
          nowMs: Date.parse("2026-06-13T00:00:00Z"),
          lowestScoringTicker: { ticker: "VOD.L", score: 22 },
        }),
      sendStep: send,
      alreadySent: () => Promise.resolve(false),
    });
    const sentKeys = send.mock.calls.map((c) => c[0].stepKey);
    expect(sentKeys).toContain("welcome_free");
    expect(sentKeys).toContain("score_explainer");
    expect(sentKeys).toContain("pro_pitch_1");
    expect(sentKeys).toContain("monthly_recap");
    expect(sentKeys).toContain("pro_pitch_final");
    expect(sentKeys).not.toContain("activation_nudge");
  });
});

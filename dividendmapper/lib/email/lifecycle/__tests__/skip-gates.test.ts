import { describe, it, expect } from "vitest";
import { evalSkipGate, type SkipContext } from "../skip-gates";

function ctx(over: Partial<SkipContext> = {}): SkipContext {
  return {
    holdingsCount: 0,
    tier: "free",
    lifecycleUnsubscribed: false,
    lastSignInAtMs: Date.now(),
    nowMs: Date.now(),
    ...over,
  };
}

describe("evalSkipGate", () => {
  describe("welcome_free", () => {
    it("does not skip a free user", () => {
      expect(evalSkipGate("welcome_free", ctx())).toBe(false);
      expect(evalSkipGate("welcome_free", ctx({ holdingsCount: 99 }))).toBe(false);
    });
    it("skips if user is already Pro", () => {
      expect(evalSkipGate("welcome_free", ctx({ tier: "pro" }))).toBe(true);
    });
  });

  describe("activation_nudge", () => {
    it("skips if user already has any holdings", () => {
      expect(evalSkipGate("activation_nudge", ctx({ holdingsCount: 1 }))).toBe(true);
    });
    it("does not skip if user has zero holdings", () => {
      expect(evalSkipGate("activation_nudge", ctx({ holdingsCount: 0 }))).toBe(false);
    });
    it("skips if user is already Pro", () => {
      expect(evalSkipGate("activation_nudge", ctx({ holdingsCount: 0, tier: "pro" }))).toBe(true);
    });
  });

  describe("score_explainer", () => {
    it("skips if user has zero holdings", () => {
      expect(evalSkipGate("score_explainer", ctx({ holdingsCount: 0 }))).toBe(true);
    });
    it("does not skip if user has at least one holding", () => {
      expect(evalSkipGate("score_explainer", ctx({ holdingsCount: 1 }))).toBe(false);
    });
    it("skips if user is already Pro", () => {
      expect(evalSkipGate("score_explainer", ctx({ holdingsCount: 1, tier: "pro" }))).toBe(true);
    });
  });

  describe("pro_pitch_1", () => {
    it("skips if zero holdings", () => {
      expect(evalSkipGate("pro_pitch_1", ctx({ holdingsCount: 0 }))).toBe(true);
    });
    it("skips if user is already Pro", () => {
      expect(evalSkipGate("pro_pitch_1", ctx({ holdingsCount: 5, tier: "pro" }))).toBe(true);
    });
    it("does not skip free user with holdings", () => {
      expect(evalSkipGate("pro_pitch_1", ctx({ holdingsCount: 3 }))).toBe(false);
    });
  });

  describe("monthly_recap", () => {
    it("skips if zero holdings", () => {
      expect(evalSkipGate("monthly_recap", ctx({ holdingsCount: 0 }))).toBe(true);
    });
    it("skips if Pro", () => {
      expect(evalSkipGate("monthly_recap", ctx({ holdingsCount: 5, tier: "pro" }))).toBe(true);
    });
    it("does not skip free with holdings", () => {
      expect(evalSkipGate("monthly_recap", ctx({ holdingsCount: 1 }))).toBe(false);
    });
  });

  describe("pro_pitch_final", () => {
    it("skips if Pro", () => {
      expect(evalSkipGate("pro_pitch_final", ctx({ tier: "pro" }))).toBe(true);
    });
    it("skips if fully dormant (no recent sign-in AND no holdings)", () => {
      const day = 24 * 60 * 60 * 1000;
      const now = Date.now();
      expect(
        evalSkipGate(
          "pro_pitch_final",
          ctx({ holdingsCount: 0, lastSignInAtMs: now - 31 * day, nowMs: now }),
        ),
      ).toBe(true);
    });
    it("does not skip a free user with holdings", () => {
      expect(evalSkipGate("pro_pitch_final", ctx({ holdingsCount: 1 }))).toBe(false);
    });
    it("does not skip a free user with no holdings but recent sign-in", () => {
      const day = 24 * 60 * 60 * 1000;
      const now = Date.now();
      expect(
        evalSkipGate(
          "pro_pitch_final",
          ctx({ holdingsCount: 0, lastSignInAtMs: now - 5 * day, nowMs: now }),
        ),
      ).toBe(false);
    });
  });

  describe("unsubscribe", () => {
    it("non-transactional steps skip when unsubscribed", () => {
      const c = ctx({ holdingsCount: 5, lifecycleUnsubscribed: true });
      expect(evalSkipGate("score_explainer", c)).toBe(true);
      expect(evalSkipGate("pro_pitch_1", c)).toBe(true);
      expect(evalSkipGate("monthly_recap", c)).toBe(true);
      expect(evalSkipGate("pro_pitch_final", c)).toBe(true);
    });
    it("transactional steps ignore unsubscribed", () => {
      const c = ctx({ lifecycleUnsubscribed: true });
      expect(evalSkipGate("welcome_free", c)).toBe(false);
      expect(evalSkipGate("activation_nudge", c)).toBe(false);
    });
  });
});

import { describe, it, expect } from "vitest";
import { SEQUENCE, type LifecycleStepKey } from "../sequence";

describe("lifecycle SEQUENCE", () => {
  it("has 6 steps in ascending day order", () => {
    expect(SEQUENCE).toHaveLength(6);
    const days = SEQUENCE.map((s) => s.daysAfterSignup);
    expect(days).toEqual([0, 3, 7, 14, 30, 60]);
  });

  it("has unique step keys", () => {
    const keys = SEQUENCE.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks the welcome and activation nudge as transactional", () => {
    const byKey = Object.fromEntries(SEQUENCE.map((s) => [s.key, s])) as Record<
      LifecycleStepKey,
      (typeof SEQUENCE)[number]
    >;
    expect(byKey.welcome_free.transactional).toBe(true);
    expect(byKey.activation_nudge.transactional).toBe(true);
    expect(byKey.score_explainer.transactional).toBe(false);
    expect(byKey.pro_pitch_1.transactional).toBe(false);
    expect(byKey.monthly_recap.transactional).toBe(false);
    expect(byKey.pro_pitch_final.transactional).toBe(false);
  });

  it("each step has a non-empty subject", () => {
    for (const step of SEQUENCE) {
      expect(step.subject.length).toBeGreaterThan(0);
    }
  });
});

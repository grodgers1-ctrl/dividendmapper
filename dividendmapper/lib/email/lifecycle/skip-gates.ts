// Pure skip-gates per lifecycle step. Each returns true if the email for this
// step should NOT be sent to this user right now. Tested in isolation; the
// cron orchestrator combines these with the time gate and the sent_emails
// idempotency check.

import { SEQUENCE, type LifecycleStepKey } from "./sequence";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SkipContext {
  holdingsCount: number;
  tier: "free" | "pro" | "premium";
  lifecycleUnsubscribed: boolean;
  lastSignInAtMs: number | null;
  nowMs: number;
}

const STEPS_BY_KEY = Object.fromEntries(SEQUENCE.map((s) => [s.key, s])) as Record<
  LifecycleStepKey,
  (typeof SEQUENCE)[number]
>;

export function evalSkipGate(key: LifecycleStepKey, ctx: SkipContext): boolean {
  const step = STEPS_BY_KEY[key];
  if (!step) return true;

  if (!step.transactional && ctx.lifecycleUnsubscribed) return true;

  switch (key) {
    case "welcome_free":
      return false;

    case "activation_nudge":
      return ctx.holdingsCount >= 1;

    case "score_explainer":
      return ctx.holdingsCount === 0;

    case "pro_pitch_1":
      if (ctx.tier !== "free") return true;
      return ctx.holdingsCount === 0;

    case "monthly_recap":
      if (ctx.tier !== "free") return true;
      return ctx.holdingsCount === 0;

    case "pro_pitch_final": {
      if (ctx.tier !== "free") return true;
      const dormantNoHoldings =
        ctx.holdingsCount === 0 &&
        ctx.lastSignInAtMs !== null &&
        ctx.nowMs - ctx.lastSignInAtMs > 30 * DAY_MS;
      return dormantNoHoldings;
    }
  }
}

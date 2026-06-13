import { SEQUENCE, type LifecycleStepKey } from "./sequence";
import { evalSkipGate } from "./skip-gates";
import type { LifecycleContext } from "./build-context";

// Pure cron orchestrator. Walks each user against every step that's overdue,
// applies the skip-gate, checks idempotency, calls sendStep. Returns counts.
// The cron route adapts this to live Supabase + Resend; the dispatcher takes
// a LifecycleContext and emits the actual email.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LifecycleUser {
  userId: string;
  email: string;
  tier: "free" | "pro" | "premium";
  createdAt: string;
  lastSignInAt: string | null;
  lifecycleUnsubscribed: boolean;
}

export interface SendStepArgs {
  user: LifecycleUser;
  stepKey: LifecycleStepKey;
  context: LifecycleContext;
}

export type SendStepResult =
  | { ok: true; emailId: string | null }
  | { ok: false; reason: string };

export interface RunLifecycleOpts {
  users: LifecycleUser[];
  nowMs: number;
  buildCtx: (user: LifecycleUser) => Promise<LifecycleContext>;
  sendStep: (args: SendStepArgs) => Promise<SendStepResult>;
  alreadySent: (userId: string, sendKey: string) => Promise<boolean>;
  onSkipped?: (
    userId: string,
    stepKey: LifecycleStepKey,
    reason: "gate",
  ) => void | Promise<void>;
}

export interface RunLifecycleResult {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runLifecycle(opts: RunLifecycleOpts): Promise<RunLifecycleResult> {
  let attempted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of opts.users) {
    if (!user.lastSignInAt) continue;
    const createdMs = Date.parse(user.createdAt);
    if (Number.isNaN(createdMs)) continue;
    const ageDays = (opts.nowMs - createdMs) / DAY_MS;

    let ctx: LifecycleContext | null = null;
    for (const step of SEQUENCE) {
      if (ageDays < step.daysAfterSignup) continue;
      const sendKey = `lifecycle_${step.key}_${user.userId}`;
      if (await opts.alreadySent(user.userId, sendKey)) continue;

      if (!ctx) ctx = await opts.buildCtx(user);

      if (evalSkipGate(step.key, ctx)) {
        if (opts.onSkipped) await opts.onSkipped(user.userId, step.key, "gate");
        skipped++;
        continue;
      }

      attempted++;
      const result = await opts.sendStep({ user, stepKey: step.key, context: ctx });
      if (result.ok) sent++;
      else failed++;
    }
  }

  return { attempted, sent, skipped, failed };
}

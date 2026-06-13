import type { SupabaseClient } from "@supabase/supabase-js";
import { sendIdempotent } from "@/lib/email/send";
import { signLifecycleUnsubToken } from "./unsub-token";
import { SEQUENCE, type LifecycleStepKey } from "./sequence";
import type { LifecycleContext } from "./build-context";
import type { LifecycleUser, SendStepResult } from "./run-lifecycle";
import { LifecycleWelcomeFreeEmail } from "@/emails/lifecycle-welcome-free";
import { LifecycleActivationNudgeEmail } from "@/emails/lifecycle-activation-nudge";

// Maps a lifecycle step key to its template component, builds the email
// args (including the per-user unsubscribe URL + List-Unsubscribe headers),
// and delegates to sendIdempotent. Steps 3-6 (score_explainer, pro_pitch_1,
// monthly_recap, pro_pitch_final) are wired in Task 19 once their templates
// and data dependencies land. Until then they return step_not_yet_wired so
// the cron logs and moves on.

const STEPS = Object.fromEntries(SEQUENCE.map((s) => [s.key, s])) as Record<
  LifecycleStepKey,
  (typeof SEQUENCE)[number]
>;

export interface DispatchArgs {
  user: LifecycleUser;
  stepKey: LifecycleStepKey;
  context: LifecycleContext;
  supabase: SupabaseClient;
  siteUrl: string;
  cronSecret: string;
}

export async function dispatchLifecycleStep(args: DispatchArgs): Promise<SendStepResult> {
  const step = STEPS[args.stepKey];
  if (!step) return { ok: false, reason: "unknown_step" };

  const unsubToken = signLifecycleUnsubToken(args.user.userId, args.cronSecret);
  const unsubscribeUrl = `${args.siteUrl}/api/lifecycle/unsubscribe?token=${unsubToken}`;
  const addHoldingUrl = `${args.siteUrl}/app`;

  const headers = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  const common = {
    to: args.user.email,
    subject: step.subject,
    template: step.key,
    sendKey: `lifecycle_${step.key}_${args.user.userId}`,
    userId: args.user.userId,
    supabase: args.supabase,
    headers,
  };

  switch (step.key) {
    case "welcome_free": {
      const result = await sendIdempotent({
        ...common,
        body: LifecycleWelcomeFreeEmail({ addHoldingUrl, unsubscribeUrl }),
      });
      return result.ok
        ? { ok: true, emailId: result.emailId }
        : { ok: false, reason: result.reason };
    }
    case "activation_nudge": {
      const result = await sendIdempotent({
        ...common,
        body: LifecycleActivationNudgeEmail({ addHoldingUrl, unsubscribeUrl }),
      });
      return result.ok
        ? { ok: true, emailId: result.emailId }
        : { ok: false, reason: result.reason };
    }
    default:
      return { ok: false, reason: "step_not_yet_wired" };
  }
}

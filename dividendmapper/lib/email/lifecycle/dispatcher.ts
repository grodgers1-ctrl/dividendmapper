import type { SupabaseClient } from "@supabase/supabase-js";
import { sendIdempotent, type SendResult } from "@/lib/email/send";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { signLifecycleUnsubToken } from "./unsub-token";
import { SEQUENCE, type LifecycleStepKey } from "./sequence";
import type { LifecycleContext } from "./build-context";
import type { LifecycleUser, SendStepResult } from "./run-lifecycle";
import { LifecycleWelcomeFreeEmail } from "@/emails/lifecycle-welcome-free";
import { LifecycleActivationNudgeEmail } from "@/emails/lifecycle-activation-nudge";
import { LifecycleScoreExplainerEmail } from "@/emails/lifecycle-score-explainer";
import { LifecycleProPitch1Email } from "@/emails/lifecycle-pro-pitch-1";
import { LifecycleMonthlyRecapEmail } from "@/emails/lifecycle-monthly-recap";
import { LifecycleProPitchFinalEmail } from "@/emails/lifecycle-pro-pitch-final";

// Maps a lifecycle step key to its template component, builds the email
// args (per-user unsubscribe URL + List-Unsubscribe headers), and delegates
// to sendIdempotent. Each step has a short-circuit guard: when the data
// needed to write a specific body isn't available (no scored holdings yet,
// no recap content, Stripe not configured) we return ok=false so the cron
// counts it and moves on without sending a thin email.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PRO_PITCH_LINES = 2;

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

  const settle = async (result: SendResult): Promise<SendStepResult> => {
    if (result.ok) {
      await captureServerEvent(args.user.userId, "lifecycle_email_sent", {
        template: step.key,
        days_after_signup: step.daysAfterSignup,
      });
      return { ok: true, emailId: result.emailId };
    }
    return { ok: false, reason: result.reason };
  };

  const unsubToken = signLifecycleUnsubToken(args.user.userId, args.cronSecret);
  const unsubscribeUrl = `${args.siteUrl}/api/lifecycle/unsubscribe?token=${unsubToken}`;
  const addHoldingUrl = `${args.siteUrl}/app`;
  const pricingUrl = `${args.siteUrl}/pricing`;
  const portfolioUrl = `${args.siteUrl}/app`;

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
      return settle(result);
    }

    case "activation_nudge": {
      const result = await sendIdempotent({
        ...common,
        body: LifecycleActivationNudgeEmail({ addHoldingUrl, unsubscribeUrl }),
      });
      return settle(result);
    }

    case "score_explainer": {
      if (!args.context.lowestScoringTicker) {
        return { ok: false, reason: "no_data_yet" };
      }
      const { ticker, score } = args.context.lowestScoringTicker;
      const holdingUrl = `${args.siteUrl}/app/holdings/${encodeURIComponent(ticker)}`;
      const result = await sendIdempotent({
        ...common,
        body: LifecycleScoreExplainerEmail({
          lowestTicker: ticker,
          lowestScore: score,
          holdingUrl,
          unsubscribeUrl,
        }),
      });
      return settle(result);
    }

    case "pro_pitch_1": {
      if (args.context.proPitchLines.length < MIN_PRO_PITCH_LINES) {
        return { ok: false, reason: "insufficient_data" };
      }
      const result = await sendIdempotent({
        ...common,
        body: LifecycleProPitch1Email({
          lines: args.context.proPitchLines.slice(0, 5),
          pricingUrl,
          unsubscribeUrl,
        }),
      });
      return settle(result);
    }

    case "monthly_recap": {
      if (
        args.context.recentScoreMoves.length === 0 &&
        args.context.upcomingExDivs.length === 0
      ) {
        return { ok: false, reason: "no_recap_content" };
      }
      const result = await sendIdempotent({
        ...common,
        body: LifecycleMonthlyRecapEmail({
          scoreMoves: args.context.recentScoreMoves,
          exDivs: args.context.upcomingExDivs,
          portfolioUrl,
          unsubscribeUrl,
        }),
      });
      return settle(result);
    }

    case "pro_pitch_final": {
      const couponId = process.env.STRIPE_COUPON_LIFECYCLE_DAY60;
      if (!couponId) {
        return { ok: false, reason: "stripe_not_configured" };
      }
      const { generateLifecycleProCode } = await import("./pro-code");
      const generated = await generateLifecycleProCode({
        couponId,
        nowMs: args.context.nowMs,
      });
      const expiresOn = new Date(args.context.nowMs + SEVEN_DAYS_MS);
      const expiresOnLabel = expiresOn.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const result = await sendIdempotent({
        ...common,
        body: LifecycleProPitchFinalEmail({
          code: generated.code,
          expiresOnLabel,
          pricingUrl,
          unsubscribeUrl,
        }),
      });
      return settle(result);
    }
  }
}

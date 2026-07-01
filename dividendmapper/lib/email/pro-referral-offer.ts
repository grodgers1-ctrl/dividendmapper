// Pure gate for the day-21 Pro referral offer. Mirrors the style of
// lib/email/lifecycle/skip-gates.ts — no Supabase, unit-testable in isolation.
// The cron orchestrator combines this with the sent_emails idempotency check
// and the actual code issuance.

export const PRO_REFERRAL_DELAY_DAYS = 21;

// True iff the user is due the referral offer: they haven't been sent it yet
// and at least PRO_REFERRAL_DELAY_DAYS have passed since they became Pro.
export function shouldSendReferralOffer(args: {
  daysSincePro: number;
  alreadySent: boolean;
}): boolean {
  return !args.alreadySent && args.daysSincePro >= PRO_REFERRAL_DELAY_DAYS;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateGrantCode } from "./grant-codes";

// Idempotently mints (or re-fetches) the single pro_referral grant code that a
// Pro user hands to a friend for a no-card 7-day Pro trial. Called by the
// day-21 referral cron (Task 4) and any "get my referral link" surface.
//
// `supabase` MUST be a service-role client: grant_codes has no client-side
// write policy, so the INSERT below only succeeds under the service role.
//
// Idempotent by design — a user has at most one live pro_referral code. If one
// already exists we return it (alreadyIssued: true) rather than minting a
// second, so repeated cron runs / repeated "copy link" clicks are safe.

interface IssueReferralCodeArgs {
  userId: string;
  email: string;
}

interface IssueReferralCodeResult {
  code: string;
  alreadyIssued: boolean;
}

export async function issueReferralCodeForUser(
  supabase: SupabaseClient,
  { userId, email }: IssueReferralCodeArgs,
): Promise<IssueReferralCodeResult> {
  const { data: existing, error: selectError } = await supabase
    .from("grant_codes")
    .select("code")
    .eq("issuer_user_id", userId)
    .eq("kind", "pro_referral")
    .maybeSingle<{ code: string }>();

  if (selectError) {
    throw new Error(
      `issueReferralCodeForUser: existing-code lookup failed: ${selectError.message}`,
    );
  }

  if (existing) {
    return { code: existing.code, alreadyIssued: true };
  }

  const code = generateGrantCode(email);
  const { error: insertError } = await supabase.from("grant_codes").insert({
    kind: "pro_referral",
    code,
    issuer_user_id: userId,
    grants_tier: "pro",
    grants_days: 7,
    max_redemptions: 1,
  });

  if (insertError) {
    throw new Error(
      `issueReferralCodeForUser: insert failed: ${insertError.message}`,
    );
  }

  return { code, alreadyIssued: false };
}

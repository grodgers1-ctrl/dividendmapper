import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { notifyFounders } from "@/lib/founder/notify";

// Core referral-trial redemption. This is the single place both redemption
// routes (session-authed POST /api/referral/redeem and post-magic-link GET
// /api/referral/claim) delegate to — they differ only in transport.
//
// `supabase` MUST be a service-role client: the redeem_grant_code() RPC has
// EXECUTE revoked from anon + authenticated (it's a security-definer function
// that takes a caller-supplied p_user_id), and grant_codes / grant_redemptions
// have no client-side read policy for anonymous friends. Passing a session
// client here will fail with a permission error and map to reason "error".

export type RedeemResult =
  | { ok: true; tierExpiresAt: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "expired"
        | "exhausted"
        | "already_redeemed"
        | "self_redemption"
        | "ineligible_tier"
        | "error";
    };

interface RedeemArgs {
  userId: string;
  code: string;
}

interface GrantCodeRow {
  id: string;
  code: string;
  issuer_user_id: string | null;
  grants_days: number;
  grants_tier: string;
}

// Maps the distinct exception messages raised by redeem_grant_code() (the text
// surfaces in the supabase rpc error's .message) onto RedeemResult reasons.
// The RPC is the single source of truth for the expired/exhausted/per-code
// checks — we deliberately do NOT re-check those in app code (avoids TOCTOU).
//
// COUPLING: the string literals below (grant_code_not_found, grant_code_expired,
// grant_code_exhausted, grant_code_already_redeemed, profile_ineligible_tier,
// profile_not_found) MUST stay in sync with the exact `raise exception '...'`
// messages in supabase/migrations/0031_referral_trials.sql. There is no shared
// constant possible across the SQL/TS boundary. Renaming a sentinel in the
// migration without updating it here silently degrades that case to reason
// "error" — the fail-closed direction (redemption is rejected, never wrongly
// granted), so it's safe, but it does mask the true reason from callers.
function mapRpcError(message: string): RedeemResult {
  if (message.includes("grant_code_not_found")) return { ok: false, reason: "not_found" };
  if (message.includes("grant_code_expired")) return { ok: false, reason: "expired" };
  if (message.includes("grant_code_exhausted")) return { ok: false, reason: "exhausted" };
  if (message.includes("grant_code_already_redeemed"))
    return { ok: false, reason: "already_redeemed" };
  if (message.includes("profile_ineligible_tier"))
    return { ok: false, reason: "ineligible_tier" };
  // profile_not_found and anything unexpected both fold into a generic error;
  // profile_not_found in particular should be impossible for a signed-in user
  // (the signup trigger creates the profile row), so it's a real fault worth
  // logging rather than a friendly user-facing state.
  console.error("[redeem-grant-code] unmapped RPC error", { message });
  return { ok: false, reason: "error" };
}

// supabase-js returns a `returns table(...)` RPC as an array of rows, but be
// defensive about a single-object shape too.
function readExpiry(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "tier_expires_at" in row) {
    const value = (row as { tier_expires_at: unknown }).tier_expires_at;
    if (typeof value === "string") return value;
  }
  return null;
}

export async function redeemGrantCode(
  supabase: SupabaseClient,
  { userId, code }: RedeemArgs,
): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();

  // 1. Fetch the code row. Codes are stored uppercase (both slug + suffix are
  //    uppercase at issue time), so an exact .eq match is correct. We need this
  //    row for the two checks the RPC cannot do (self-redemption) plus the
  //    issuer id for the founder ping + analytics.
  const { data: row, error: rowError } = await supabase
    .from("grant_codes")
    .select("id, code, issuer_user_id, grants_days, grants_tier")
    .eq("code", normalized)
    .maybeSingle<GrantCodeRow>();

  if (rowError || !row) {
    // A select error here (vs. a genuinely-missing row) is rare, but from the
    // redeemer's point of view "we couldn't find your code" is the honest
    // outcome either way; the RPC would also raise grant_code_not_found.
    if (rowError) console.error("[redeem-grant-code] grant_codes lookup failed", rowError);
    return { ok: false, reason: "not_found" };
  }

  // 2. Self-redemption: an issuer cannot redeem their own referral code. The
  //    RPC has no notion of "issuer", so this must live in app code.
  if (row.issuer_user_id && row.issuer_user_id === userId) {
    return { ok: false, reason: "self_redemption" };
  }

  // 3. One-trial-ever guard across ALL codes (the RPC's already-redeemed check
  //    is per-code only). Known limitation: a user who deletes their account
  //    and re-signs up with the same email gets a fresh auth uid and would
  //    bypass this — acceptable for a small indie SaaS.
  const { data: priorRedemptions, error: redemptionError } = await supabase
    .from("grant_redemptions")
    .select("id")
    .eq("redeemed_by_user_id", userId)
    .limit(1);

  if (redemptionError) {
    console.error("[redeem-grant-code] prior-redemption lookup failed", redemptionError);
    return { ok: false, reason: "error" };
  }
  if (priorRedemptions && priorRedemptions.length > 0) {
    return { ok: false, reason: "already_redeemed" };
  }

  // 4. Atomic redemption. The RPC locks the code row FOR UPDATE and is the
  //    single source of truth for expired/exhausted/per-code-already-redeemed
  //    and the profile eligibility flip.
  const { data, error } = await supabase.rpc("redeem_grant_code", {
    p_code: normalized,
    p_user_id: userId,
  });

  if (error) {
    return mapRpcError(error.message ?? "");
  }

  const tierExpiresAt = readExpiry(data);
  if (!tierExpiresAt) {
    console.error("[redeem-grant-code] RPC returned no expiry", { data });
    return { ok: false, reason: "error" };
  }

  // 5. Success side effects. Both are non-fatal: a PostHog / email hiccup must
  //    never turn a committed redemption into a failure. They already swallow
  //    their own errors, but wrap defensively so nothing throws up the stack.
  try {
    await captureServerEvent(userId, "trial_started", {
      code: normalized,
      grants_days: row.grants_days,
      issuer_user_id: row.issuer_user_id,
    });
  } catch (err) {
    console.error("[redeem-grant-code] trial_started capture failed", err);
  }

  try {
    // Stable + unique per redemption: userId is one-trial-ever, so this is
    // idempotent for retries yet never blocks a different redemption.
    await notifyFounders(supabase, {
      sendKey: `founder_trial_redeemed_${userId}`,
      subject: "Trial redeemed",
      heading: "Someone redeemed a referral trial",
      lines: [
        `Code: ${normalized}`,
        `Issuer user id: ${row.issuer_user_id ?? "n/a (campaign code)"}`,
        `Redeemer user id: ${userId}`,
        `Trial ends: ${tierExpiresAt}`,
      ],
    });
  } catch (err) {
    console.error("[redeem-grant-code] founder notify failed", err);
  }

  return { ok: true, tierExpiresAt };
}

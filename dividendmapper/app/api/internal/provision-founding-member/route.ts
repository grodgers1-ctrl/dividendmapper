import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing/stripe";
import {
  deriveSlugFromEmail,
  randomCodeSuffix,
} from "@/lib/billing/founding-codes";
import { sendIdempotent } from "@/lib/email/send";
import { WelcomeFoundingMemberEmail } from "@/emails/welcome-founding-member";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/internal/provision-founding-member
//
// Idempotent. Given a user_id, generates 3 Stripe promotion codes against
// the founding_member_50_off_pro_6mo coupon and mirrors them into
// founding_member_codes. If 3 rows already exist for the user, returns
// the existing ones without re-hitting Stripe.
//
// Auth: shared-secret header. The route runs with the service-role key
// so RLS doesn't apply; the bearer token is the only access control.
// Called manually from a small provisioning script (or curl) until signup
// volume justifies pg_net automation.

const CODES_PER_MEMBER = 3;
const TWELVE_MONTHS_SECONDS = 60 * 60 * 24 * 365;

type ProfileRow = {
  id: string;
  email: string;
  founding_member: boolean;
  tier_expires_at: string | null;
};

type CodeRow = {
  id: string;
  code: string;
  stripe_promotion_code_id: string;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
};

export async function POST(req: Request) {
  const provisioningToken = process.env.INTERNAL_PROVISIONING_TOKEN;
  if (!provisioningToken) {
    console.error(
      "[internal/provision-founding-member] INTERNAL_PROVISIONING_TOKEN not set",
    );
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${provisioningToken}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const couponId = process.env.STRIPE_FOUNDING_COUPON_ID;
  if (!couponId) {
    console.error(
      "[internal/provision-founding-member] STRIPE_FOUNDING_COUPON_ID not set",
    );
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error(
      "[internal/provision-founding-member] missing service-role env",
    );
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const userId = (body as Record<string, unknown>).user_id;
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, founding_member, tier_expires_at")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (profileError) {
    console.error(
      "[internal/provision-founding-member] profile query failed",
      profileError,
    );
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  if (!profile.founding_member) {
    return NextResponse.json(
      { error: "not_founding_member" },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("founding_member_codes")
    .select("id, code, stripe_promotion_code_id, redeemed_at, redeemed_by_user_id")
    .eq("member_user_id", userId)
    .returns<CodeRow[]>();
  if (existingError) {
    console.error(
      "[internal/provision-founding-member] existing query failed",
      existingError,
    );
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const existingCount = existing?.length ?? 0;
  if (existingCount > 0 && existingCount < CODES_PER_MEMBER) {
    return NextResponse.json(
      {
        error: "partial_state",
        details: `User has ${existingCount}/${CODES_PER_MEMBER} codes; manual cleanup needed`,
      },
      { status: 409 },
    );
  }
  const alreadyProvisioned = existingCount === CODES_PER_MEMBER;

  let codes: CodeRow[];
  if (alreadyProvisioned) {
    codes = existing!;
  } else {
    const stripe = getStripe();
    const slug = deriveSlugFromEmail(profile.email);
    const expiresAt = Math.floor(Date.now() / 1000) + TWELVE_MONTHS_SECONDS;

    const created: Array<{ code: string; stripe_promotion_code_id: string }> = [];
    try {
      for (let i = 0; i < CODES_PER_MEMBER; i++) {
        const code = `${slug}-${randomCodeSuffix()}`;
        const promo = await stripe.promotionCodes.create({
          promotion: { type: "coupon", coupon: couponId },
          code,
          max_redemptions: 1,
          expires_at: expiresAt,
          metadata: {
            founding_member_user_id: userId,
          },
        });
        created.push({ code: promo.code, stripe_promotion_code_id: promo.id });
      }
    } catch (err) {
      console.error(
        "[internal/provision-founding-member] stripe create failed",
        err,
      );
      return NextResponse.json(
        {
          error: "stripe_create_failed",
          partial: created,
          details:
            "Some codes may have been created in Stripe but not mirrored. Run again to surface the partial-state error.",
        },
        { status: 500 },
      );
    }

    const rows = created.map((c) => ({
      member_user_id: userId,
      code: c.code,
      stripe_promotion_code_id: c.stripe_promotion_code_id,
    }));
    const { data: inserted, error: insertError } = await supabase
      .from("founding_member_codes")
      .insert(rows)
      .select(
        "id, code, stripe_promotion_code_id, redeemed_at, redeemed_by_user_id",
      )
      .returns<CodeRow[]>();
    if (insertError || !inserted) {
      console.error(
        "[internal/provision-founding-member] db insert failed",
        insertError,
      );
      return NextResponse.json(
        {
          error: "db_insert_failed",
          stripe_codes: created,
          details:
            "Codes created in Stripe but not mirrored. Manual cleanup: delete the Stripe promo codes or insert founding_member_codes rows by hand.",
        },
        { status: 500 },
      );
    }
    codes = inserted;
  }

  // Welcome email (idempotent via send_key=welcome_founding_member_<user_id>).
  // If tier_expires_at is NULL we skip the send and surface a warning. The
  // launch-day backfill (migration 0002 or the bulk-UPDATE script) must run
  // before the email goes out so the recipient sees a real expiry date.
  if (profile.tier_expires_at) {
    const expiresOnLabel = new Date(profile.tier_expires_at).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "long", year: "numeric" },
    );
    const sendResult = await sendIdempotent({
      to: profile.email,
      subject: "You're in. Three 50% off codes for friends.",
      template: "welcome_founding_member",
      sendKey: `welcome_founding_member_${userId}`,
      userId,
      body: WelcomeFoundingMemberEmail({
        codes: codes.map((c) => c.code),
        accountUrl: `${SITE_URL}/app/account`,
        expiresOnLabel,
      }),
      supabase,
    });
    if (!sendResult.ok && sendResult.reason !== "already_sent") {
      console.error(
        "[internal/provision-founding-member] welcome email send failed",
        sendResult,
      );
    }
  } else {
    console.warn(
      "[internal/provision-founding-member] tier_expires_at NULL; welcome email skipped",
      { userId },
    );
  }

  return NextResponse.json({
    ok: true,
    already_provisioned: alreadyProvisioned,
    codes,
  });
}

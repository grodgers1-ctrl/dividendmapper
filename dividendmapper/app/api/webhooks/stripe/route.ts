import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing/stripe";
import { sendIdempotent } from "@/lib/email/send";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { notifyFounders } from "@/lib/founder/notify";
import { WelcomePaidEmail } from "@/emails/welcome-paid";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe
//
// Handles three events for Phase 2 launch:
//   checkout.session.completed     → write profiles.stripe_customer_id
//   customer.subscription.updated  → upsert subscriptions row + tier flip
//   customer.subscription.deleted  → cancel sub + downgrade to free
//
// Signature verification uses the RAW request body. Next 16 exposes that via
// req.text(). DB writes go through a service-role client (second route to use
// it after /api/account/delete). Everything else returns 200 so Stripe stops
// retrying.

type LookupMapping = {
  tier: "pro" | "premium";
  billingPeriod: "monthly" | "annual";
};

const LOOKUP_KEY_TO_TIER: Record<string, LookupMapping> = {
  pro_monthly: { tier: "pro", billingPeriod: "monthly" },
  pro_annual: { tier: "pro", billingPeriod: "annual" },
  // premium_monthly / premium_annual wired when Premium ships.
};

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhooks/stripe] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[webhooks/stripe] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[webhooks/stripe] missing service-role env");
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // Stripe API 2026-04-22+ fires .created (not .updated) on initial
        // activation of a Checkout-born subscription, because there's no
        // prior state to "update." Both routes upsert via the same handler;
        // it's idempotent (onConflict: user_id), so the double-handling is
        // safe even on the unlikely chance both events fire.
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsert(supabase, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, sub);
        break;
      }
      default:
        // 200 OK for anything we don't handle, so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error("[webhooks/stripe] handler error", {
      type: event.type,
      err,
    });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
) {
  const userId = session.client_reference_id;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  if (!userId || !customerId) {
    console.warn("[webhooks/stripe] checkout.session.completed missing fields", {
      userId,
      customerId,
    });
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);
  if (error) {
    throw new Error(`profiles update failed: ${error.message}`);
  }

  // Founding-member code redemption write-back. If the checkout applied a
  // promotion code, mark the matching founding_member_codes row as redeemed.
  // session.discounts entries reference the Stripe promotion_code id, which
  // we mirrored into founding_member_codes.stripe_promotion_code_id at
  // provision time.
  await handleRedemption(supabase, session, userId);

  // Welcome email. session.customer_details.email is captured at Checkout
  // (Stripe collects it even when we don't pre-fill). subscription id is the
  // idempotency token; every paid signup gets exactly one welcome.
  const recipientEmail = session.customer_details?.email ?? session.customer_email;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  if (recipientEmail && subscriptionId) {
    const sendResult = await sendIdempotent({
      to: recipientEmail,
      subject: "Welcome to DividendMapper Pro",
      template: "welcome_paid",
      sendKey: `welcome_paid_${subscriptionId}`,
      userId,
      body: WelcomePaidEmail({
        portfolioUrl: `${SITE_URL}/app/portfolio`,
      }),
      supabase,
    });
    if (!sendResult.ok && sendResult.reason !== "already_sent") {
      console.error("[webhooks/stripe] welcome_paid send failed", sendResult);
      // Don't throw. The DB writes above already succeeded, and a failed
      // welcome email isn't worth retrying the whole webhook for.
    }
  } else {
    console.warn(
      "[webhooks/stripe] welcome_paid skipped: missing email or subscription",
      { recipientEmail, subscriptionId },
    );
  }

  await captureServerEvent(userId, "checkout_completed", {
    subscription_id: subscriptionId,
  });
}

async function handleRedemption(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  userId: string,
) {
  const discounts = session.discounts ?? [];
  if (discounts.length === 0) return;

  const recipientEmail =
    session.customer_details?.email ?? session.customer_email ?? null;

  const lifecycleCouponId = process.env.STRIPE_COUPON_LIFECYCLE_DAY60;

  for (const discount of discounts) {
    const promotionCodeId =
      typeof discount.promotion_code === "string"
        ? discount.promotion_code
        : discount.promotion_code?.id ?? null;
    if (!promotionCodeId) continue;

    // Lifecycle day-60 50% off code: distinct from founding-member codes,
    // not mirrored in any DB table. Emit a PostHog event so we can measure
    // day-60 → Pro conversion, then skip the founding-code path.
    const couponId =
      typeof discount.coupon === "string"
        ? discount.coupon
        : discount.coupon?.id ?? null;
    if (lifecycleCouponId && couponId === lifecycleCouponId) {
      await captureServerEvent(userId, "lifecycle_pro_code_redeemed", {
        promotion_code_id: promotionCodeId,
        coupon_id: couponId,
      });
      continue;
    }

    const { data: codeRow, error: codeError } = await supabase
      .from("founding_member_codes")
      .select("id, redeemed_at")
      .eq("stripe_promotion_code_id", promotionCodeId)
      .maybeSingle<{ id: string; redeemed_at: string | null }>();
    if (codeError) {
      console.error(
        "[webhooks/stripe] founding-code lookup failed",
        codeError,
      );
      continue;
    }
    if (!codeRow) {
      // Not a founding-member code (could be a regular Stripe coupon).
      continue;
    }
    if (codeRow.redeemed_at) {
      // Already marked redeemed; webhook replay or duplicate event.
      continue;
    }

    const { error: updateError } = await supabase
      .from("founding_member_codes")
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by_user_id: userId,
        redeemed_by_email: recipientEmail,
      })
      .eq("id", codeRow.id);
    if (updateError) {
      console.error(
        "[webhooks/stripe] founding-code redemption write failed",
        updateError,
      );
    }
  }
}

async function handleSubscriptionUpsert(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();
  if (profileError) {
    throw new Error(`profile lookup failed: ${profileError.message}`);
  }
  if (!profile) {
    // Race: subscription event arrived before checkout.session.completed
    // wrote stripe_customer_id. Throw so the outer catch returns 500 and
    // Stripe retries with backoff. By the second retry (~10-30s later)
    // checkout.session.completed will have written stripe_customer_id and
    // the lookup will succeed.
    console.warn(
      "[webhooks/stripe] profile not yet linked, returning 500 to trigger retry",
      customerId,
    );
    throw new Error(`profile not yet linked for customer ${customerId}`);
  }

  // Capture the prior subscription status BEFORE the upsert overwrites it, so
  // we can tell a genuine new activation (first-ever or reactivation after a
  // cancellation) apart from a renewal / plan-change. No prior row → first
  // activation; prior row that wasn't 'active' (e.g. 'canceled') → reactivation;
  // prior 'active' → renewal/plan-change (not genuine).
  const { data: priorSub, error: priorSubError } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", profile.id)
    .maybeSingle<{ status: string }>();
  if (priorSubError) {
    // Fail-safe: a transient read failure must NOT be treated as "no prior
    // row", which would mis-classify a renewal as a genuine activation and
    // fire a false founder ping. We also can't throw here — the outer catch
    // would flip an already-committed webhook to 500 and trigger a Stripe
    // retry. A missed ping is far cheaper than a false one, so suppress it.
    console.error(
      "[webhooks/stripe] priorSub read failed; treating as non-genuine activation",
      priorSubError,
    );
  }
  const isGenuineNewActivation =
    !priorSubError && (!priorSub || priorSub.status !== "active");

  const item = sub.items.data[0];
  const lookupKey = item?.price.lookup_key ?? null;
  const mapping = lookupKey ? LOOKUP_KEY_TO_TIER[lookupKey] : null;
  if (!mapping) {
    console.warn("[webhooks/stripe] unrecognised lookup_key", lookupKey);
    return;
  }

  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  if (!periodEnd) {
    console.warn("[webhooks/stripe] missing current_period_end on subscription item");
    return;
  }

  const { error: subError } = await supabase.from("subscriptions").upsert(
    {
      user_id: profile.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: item.price.id,
      tier: mapping.tier,
      billing_period: mapping.billingPeriod,
      status: sub.status,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: "user_id" },
  );
  if (subError) {
    throw new Error(`subscriptions upsert failed: ${subError.message}`);
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      tier: mapping.tier,
      tier_source: "stripe",
      tier_expires_at: null,
    })
    .eq("id", profile.id);
  if (profileUpdateError) {
    throw new Error(`profile tier update failed: ${profileUpdateError.message}`);
  }

  // Real-time founder ping + analytics, only on a genuine new activation and
  // only when the incoming subscription is actually active (skip incomplete /
  // past_due first events). The sub.id-scoped sendKey makes the ping idempotent
  // across webhook replays.
  if (isGenuineNewActivation && sub.status === "active") {
    await notifyFounders(supabase, {
      sendKey: `founder_new_pro_${sub.id}`,
      subject: "New Pro conversion",
      heading: "Someone just went Pro",
      lines: [
        `Customer: ${customerId}`,
        `Plan: ${mapping.tier} (${mapping.billingPeriod})`,
      ],
    });
    await captureServerEvent(profile.id, "pro_conversion", {
      tier: mapping.tier,
      billing_period: mapping.billingPeriod,
    });
  }
}

async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();
  if (!profile) {
    console.warn(
      "[webhooks/stripe] subscription.deleted with no matching profile",
      customerId,
    );
    return;
  }

  const { error: subError } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", profile.id);
  if (subError) {
    throw new Error(`subscription cancel failed: ${subError.message}`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ tier: "free" })
    .eq("id", profile.id);
  if (profileError) {
    throw new Error(`profile downgrade failed: ${profileError.message}`);
  }

  await notifyFounders(supabase, {
    sendKey: `founder_canceled_${sub.id}`,
    subject: "Subscription canceled",
    heading: "A Pro subscription just canceled",
    lines: [`Customer: ${customerId}`],
  });
  await captureServerEvent(profile.id, "subscription_canceled");
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing/stripe";

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
      case "customer.subscription.updated": {
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
    // wrote stripe_customer_id. Stripe will retry the deliver and we'll
    // catch up on the second pass.
    console.warn("[webhooks/stripe] no profile for customer (race)", customerId);
    return;
  }

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
}

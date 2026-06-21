import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isPricingPublic } from "@/lib/flags/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadUserPreferences } from "@/lib/scoring/preferences";
import { PageHeader } from "../_components/page-header/page-header";
import { DeleteAccount } from "./_components/delete-account";
import { FoundingCodeCard } from "./_components/founding-code-card";
import { WelcomeRefresh } from "./_components/welcome-refresh";
import { AccountWizardEntry } from "./_components/account-wizard-entry";
import { BrokerConnection, type BrokerConnectionState } from "./_components/broker-connection";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

type ProfileRow = {
  email: string;
  tier: "free" | "pro" | "premium";
  tier_source: "free" | "stripe" | "founding_member";
  tier_expires_at: string | null;
  founding_member: boolean;
  stripe_customer_id: string | null;
};

type FoundingCodeRow = {
  id: string;
  code: string;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
};

const TIER_LABEL: Record<ProfileRow["tier"], string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

interface AccountPageProps {
  searchParams: Promise<{ welcome?: string; billing_error?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  // Guard here too, not just in app/app/layout.tsx: on a soft client-side
  // navigation Next re-renders only the page segment, so the layout's
  // requireUser() doesn't re-run. requireUser redirects to /login on a null
  // session instead of throwing; getCurrentUser is cache()-memoised so this
  // stays free on a full load where the layout already called it.
  const user = await requireUser("/app/account");
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const showWelcome = params.welcome === "1";
  const billingError = typeof params.billing_error === "string";
  const pricingPublic = isPricingPublic();

  // Founding-member codes are RLS-readable by the owner (member_user_id =
  // auth.uid()), so the standard SSR client picks them up. Parallel with the
  // profile read since neither depends on the other.
  const [profileResult, codesResult, prefs, brokerResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "email, tier, tier_source, tier_expires_at, founding_member, stripe_customer_id",
      )
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("founding_member_codes")
      .select("id, code, redeemed_at, redeemed_by_user_id")
      .eq("member_user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<FoundingCodeRow[]>(),
    loadUserPreferences(user.id),
    supabase
      .from("broker_connections")
      .select("id, provider, wrapper, status, last_synced_at, last_sync_error")
      .eq("user_id", user.id)
      .eq("provider", "trading212")
      .order("created_at", { ascending: true })
      .returns<
        {
          id: string;
          provider: "trading212";
          wrapper: "isa" | "gia" | null;
          status: BrokerConnectionState["status"];
          last_synced_at: string | null;
          last_sync_error: string | null;
        }[]
      >(),
  ]);

  const profile = profileResult.data;
  const foundingCodes = codesResult.data ?? [];
  const brokerConnections: BrokerConnectionState[] = (brokerResult.data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider,
    wrapper: row.wrapper,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    lastSyncError: row.last_sync_error,
  }));
  const tier = profile?.tier ?? "free";
  const isFoundingMember = profile?.founding_member ?? false;
  // Gate the billing-portal button: a portal session needs a Stripe customer.
  // Every Stripe-sourced Pro has one (written by the webhook), but a manually
  // provisioned Pro might not, in which case the button would redirect-loop.
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  // Race window after Stripe Checkout: the redirect to /app/account?welcome=1
  // can arrive before the webhook has flipped profiles.tier='pro'. Suppress
  // the tier-state panel + show "Activating" in the badge until the next
  // refresh picks up the post-webhook state (handled by <WelcomeRefresh />).
  const stripeActivating = showWelcome && tier === "free" && !isFoundingMember;
  const expiresAt = profile?.tier_expires_at
    ? new Date(profile.tier_expires_at)
    : null;
  const expiresLabel = expiresAt
    ? expiresAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6 md:py-24">
      <PageHeader title="Account" />

      {showWelcome && (
        <>
          <div
            role="status"
            className="mt-6 rounded-xl border border-positive/30 bg-positive/10 p-5 md:mt-8 md:p-6"
          >
            <p className="font-display text-base font-semibold text-foreground">
              Welcome to Pro.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You now have unlimited holdings and the full portfolio income view
              across every wrapper. Broker sync and the dividend calendar are
              next, landing through summer 2026.
            </p>
          </div>
          {stripeActivating && <WelcomeRefresh />}
        </>
      )}

      <dl className="mt-8 space-y-6 rounded-xl border border-border bg-card p-5 md:mt-10 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Signed in as
            </dt>
            <dd className="mt-1 truncate font-mono text-sm text-foreground">
              {user.email}
            </dd>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current plan
          </dt>
          <dd className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              {stripeActivating ? "Activating…" : TIER_LABEL[tier]}
            </span>
            {isFoundingMember && (
              <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:border-brand-400/20 dark:bg-brand-900/20 dark:text-brand-300">
                Founding member
              </span>
            )}
          </dd>
        </div>

        {tier === "free" && !stripeActivating && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-display text-sm font-semibold text-foreground">
              You&apos;re on Free.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Track up to 10 holdings. Pro lifts the cap and unlocks the full
              portfolio view.
            </p>
            {pricingPublic && (
              <Link
                href="/pricing"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Upgrade to Pro
                <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        )}

        {tier === "pro" && isFoundingMember && (
          <div className="rounded-lg border border-brand-500/30 bg-brand-50 p-4 dark:border-brand-400/20 dark:bg-brand-900/20">
            <p className="font-display text-sm font-semibold text-foreground">
              {expiresLabel
                ? `You're on Pro until ${expiresLabel}.`
                : "You're on Pro through the founding-member window."}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {expiresLabel
                ? "Three 50% off codes are below. Each one is single-use and gives a friend six months of Pro."
                : "Launch is in a few days. Your expiry date and three referral codes appear here once they're provisioned."}
            </p>
          </div>
        )}

        {isFoundingMember && (
          <div className="border-t border-border pt-6">
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your 50% off codes
            </dt>
            <dd className="mt-3 space-y-3">
              {foundingCodes.length === 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your three referral codes drop here once we provision them.
                  Email hello@dividendmapper.com if they&apos;re missing by
                  launch.
                </p>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Friends paste these at checkout when they upgrade to Pro.
                  </p>
                  <div className="space-y-2">
                    {foundingCodes.map((c) => (
                      <FoundingCodeCard key={c.id} code={c} />
                    ))}
                  </div>
                </>
              )}
            </dd>
          </div>
        )}

        {tier === "pro" && !isFoundingMember && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-display text-sm font-semibold text-foreground">
              {expiresLabel
                ? `You're on Pro until ${expiresLabel}.`
                : "You're on Pro."}
            </p>
            {hasStripeCustomer ? (
              <>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Renews automatically. Manage your plan, payment method, and
                  invoices in the billing portal.
                </p>
                {billingError && (
                  <p role="alert" className="mt-3 text-sm text-negative">
                    Couldn&apos;t open the billing portal. Email
                    hello@dividendmapper.com and we&apos;ll sort it.
                  </p>
                )}
                <form
                  action="/api/billing/portal"
                  method="POST"
                  className="mt-3"
                >
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Manage billing
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Renews automatically. To make billing changes, email
                hello@dividendmapper.com.
              </p>
            )}
          </div>
        )}
      </dl>

      <section className="mt-8 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Your preferences
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          A few quick questions tune your Reinvest suggestions and when we flag a
          holding. Not financial advice.
        </p>
        <div className="mt-4">
          <AccountWizardEntry initial={prefs} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Alert emails</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Choose when we email you about a holding&apos;s Quality or Risk score. Pro feature.
        </p>
        <Link
          href="/app/account/notifications"
          className="mt-3 inline-block text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          Manage alert emails
        </Link>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Connected brokers
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Sync your Trading 212 holdings and real dividend income automatically. Pro feature.
        </p>
        <div className="mt-4">
          <BrokerConnection isPro={tier !== "free"} connections={brokerConnections} />
        </div>
      </section>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Sign out
        </button>
      </form>

      <section
        aria-labelledby="danger-zone-heading"
        className="mt-16 rounded-xl border border-negative/30 bg-card p-5 md:p-6"
      >
        <h2
          id="danger-zone-heading"
          className="font-display text-lg font-semibold text-negative"
        >
          Danger zone
        </h2>
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="font-display text-base font-semibold text-foreground">
            Delete account
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Permanently deletes your account, all your holdings, and any
            active subscription. We can&apos;t undo this. Your data is gone
            once you confirm.
          </p>
          <div className="mt-5">
            <DeleteAccount />
          </div>
        </div>
      </section>
    </div>
  );
}

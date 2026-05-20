import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeleteAccount } from "./_components/delete-account";

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
  searchParams: Promise<{ welcome?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  // app/app/layout.tsx already gates via requireUser(). getCurrentUser is
  // cache()-memoised across the same request, so this is free.
  const user = (await getCurrentUser())!;
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const showWelcome = params.welcome === "1";

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, tier, tier_source, tier_expires_at, founding_member")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const tier = profile?.tier ?? "free";
  const isFoundingMember = profile?.founding_member ?? false;
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
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Account
      </h1>

      {showWelcome && (
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
              {TIER_LABEL[tier]}
            </span>
            {isFoundingMember && (
              <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:border-brand-400/20 dark:bg-brand-900/20 dark:text-brand-300">
                Founding member
              </span>
            )}
          </dd>
        </div>

        {tier === "free" && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-display text-sm font-semibold text-foreground">
              You&apos;re on Free.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Track up to 10 holdings. Pro lifts the cap and unlocks the full
              portfolio view.
            </p>
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
                ? "Your three 50% off Pro referral codes land on this page next week."
                : "Launch lands in the next few days. Your expiry date will appear here once it's set."}
            </p>
          </div>
        )}

        {tier === "pro" && !isFoundingMember && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-display text-sm font-semibold text-foreground">
              {expiresLabel
                ? `You're on Pro until ${expiresLabel}.`
                : "You're on Pro."}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Manage billing and cancel in the Stripe customer portal. The
              link ships with the billing page.
            </p>
          </div>
        )}
      </dl>

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

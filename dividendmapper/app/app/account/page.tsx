import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export default async function AccountPage() {
  // app/app/layout.tsx already gates via requireUser(). getCurrentUser is
  // cache()-memoised across the same request, so this is free.
  const user = (await getCurrentUser())!;
  const supabase = await createSupabaseServerClient();

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
    <div className="mx-auto max-w-2xl px-4 py-16 md:px-6 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Account
      </h1>

      <dl className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Signed in as
            </dt>
            <dd className="mt-1 font-mono text-sm text-foreground">
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

        {isFoundingMember && (
          <div className="rounded-lg border border-brand-500/30 bg-brand-50 p-4 dark:border-brand-400/20 dark:bg-brand-900/20">
            <p className="font-display text-sm font-semibold text-foreground">
              {expiresLabel
                ? `You're on Pro until ${expiresLabel}.`
                : "You're on Pro through the founding-member window."}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {expiresLabel
                ? "Your three 50% off Pro referral codes land on this page next week."
                : "Launch lands in the next few days — your expiry date will appear here once it's set."}
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
    </div>
  );
}

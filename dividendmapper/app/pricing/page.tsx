import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { isPricingPublic } from "@/lib/flags/pricing";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProPrice } from "./_components/pro-price";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free dividend portfolio tools, plus a Pro tier that lifts the 10-holding cap, scores every holding for quality and risk, and ships broker sync and alerts in 2026.",
};

// Per-user (auth + founding-member status) and per-request, never cached.
export const dynamic = "force-dynamic";

type ProfileRow = {
  tier: "free" | "pro" | "premium";
  tier_expires_at: string | null;
  founding_member: boolean;
};

const FREE_FEATURES = [
  "Retirement and DCF calculators, free forever",
  "Track up to 10 holdings manually",
  "Annual income view across the holdings you add",
  "UK and US wrapper support: ISA, SIPP, 401(k), IRA, brokerage",
];

const PRO_FEATURES = [
  "Everything in Free",
  "No holdings cap, track as many as you own",
  "Full portfolio income across every holding, every wrapper",
  "Daily Quality, Risk and Trim scores that flag cut risk and stretched valuations",
  "Tax notes on each wrapper, GIA dividend-allowance warnings",
];

const PRO_COMING_SOON = [
  "Trading 212 auto-sync (Phase 3, summer 2026)",
  "Dividend calendar with ex-div and payment dates",
  "Smart alerts on dividend cuts, raises, and ex-div",
];

export default async function PricingPage() {
  if (!isPricingPublic()) {
    notFound();
  }

  const user = await getCurrentUser();
  let profile: ProfileRow | null = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("tier, tier_expires_at, founding_member")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();
    profile = data;
  }

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
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Free covers the basics. Pro tracks your whole portfolio and scores
          every holding for quality and risk. Broker sync, alerts, and the
          dividend calendar arrive through 2026.
        </p>
      </header>

      {!user && (
        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-brand-500/30 bg-brand-50 p-5 dark:border-brand-400/20 dark:bg-brand-900/20">
          <p className="font-display text-sm font-semibold text-foreground">
            Already on our founding-member list?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Sign in with the email you gave us. Your six months of Pro is
            already on your account, no card needed.{" "}
            <Link
              href="/login?next=%2Fpricing"
              className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}

      {user && isFoundingMember && (
        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-brand-500/30 bg-brand-50 p-5 dark:border-brand-400/20 dark:bg-brand-900/20">
          <p className="font-display text-sm font-semibold text-foreground">
            {expiresLabel
              ? `You're already on Pro until ${expiresLabel}.`
              : "You're already on Pro through the founding-member window."}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your three 50% off Pro referral codes land on your{" "}
            <Link
              href="/app/account"
              className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              account page
            </Link>{" "}
            next week.
          </p>
        </div>
      )}

      <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-2">
        {/* Free */}
        <section
          aria-labelledby="plan-free"
          className="flex flex-col rounded-xl border border-border bg-card p-6 md:p-8"
        >
          <header>
            <h2
              id="plan-free"
              className="font-display text-2xl font-bold text-foreground"
            >
              Free
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For working out the basics on your own portfolio.
            </p>
          </header>

          <div className="mt-6">
            <p className="font-mono text-4xl font-semibold tabular-nums text-foreground md:text-5xl">
              £0
              <span className="ml-1 text-base font-medium text-muted-foreground">
                forever
              </span>
            </p>
          </div>

          <Link
            href="/login?next=%2Fapp%2Fportfolio"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card"
          >
            Get started
          </Link>

          <ul className="mt-8 space-y-3 text-sm">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-3">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Pro */}
        <section
          aria-labelledby="plan-pro"
          className="relative flex flex-col rounded-xl border border-brand-500 bg-card p-6 ring-1 ring-brand-500/30 md:p-8"
        >
          <div className="absolute -top-3 right-6 inline-flex items-center rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
            Most useful
          </div>

          <header>
            <h2
              id="plan-pro"
              className="font-display text-2xl font-bold text-foreground"
            >
              Pro
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For tracking a real portfolio without spreadsheets.
            </p>
          </header>

          <div className="mt-6">
            <ProPrice />
          </div>

          {user ? (
            <form
              action="/api/billing/checkout"
              method="post"
              className="mt-6"
            >
              <input type="hidden" name="lookup_key" value="pro_monthly" />
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-card sm:w-auto"
              >
                Start Pro
              </button>
            </form>
          ) : (
            <Link
              href="/login?next=%2Fpricing"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-card sm:w-auto"
            >
              Sign in to start Pro
            </Link>
          )}

          <ul className="mt-8 space-y-3 text-sm">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-3">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/scoring-methodology"
            className="mt-4 inline-block text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            How the scores work
          </Link>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Coming soon
            </p>
            <ul className="mt-3 space-y-3 text-sm">
              {PRO_COMING_SOON.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <Clock
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <footer className="mx-auto mt-12 max-w-3xl space-y-3 text-center text-xs text-muted-foreground md:mt-16">
        <p>
          Prices include UK VAT where it applies. Cancel any time from the
          Stripe customer portal.
        </p>
        <p>
          DividendMapper provides informational tools only. None of this is
          financial or tax advice.
        </p>
      </footer>
    </div>
  );
}

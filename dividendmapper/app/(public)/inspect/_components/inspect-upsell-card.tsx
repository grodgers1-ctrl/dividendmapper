// Tier-aware upsell card for the Inspect ticker page. Pro users see nothing;
// anon and free users see a small card pointing them to signup or pricing.
//
// The ISR page hard-codes tier="anon" for now (the page is statically rendered
// and reading auth would force it dynamic). Day 6/8 will move this behind a
// small client island that re-reads auth.

import Link from "next/link";

type Tier = "anon" | "free" | "pro";

type Props = { tier: Tier };

export function InspectUpsellCard({ tier }: Props) {
  if (tier === "pro") return null;

  const isAnon = tier === "anon";
  const headline = isAnon
    ? "Sign up free to look up 10 stocks a day."
    : "Want unlimited research? Upgrade to Pro.";
  const body = isAnon
    ? "Anonymous lookups are capped at three a day. A free account bumps that to ten, and your counter resets at midnight UK time."
    : "Pro lifts the daily lookup cap and unlocks Quality, Trim and Risk scores on every holding in your portfolio.";
  const ctaHref = isAnon ? "/login" : "/pricing";
  const ctaLabel = isAnon ? "Sign up free" : "See pricing";

  return (
    <div className="mt-10 rounded-[10px] border border-brand-500/30 bg-brand-500/5 p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-brand-700 dark:text-brand-400">
        {isAnon ? "Free account" : "Pro"}
      </p>
      <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground">
        {headline}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <div className="mt-4">
        <Link
          href={ctaHref}
          className="inline-flex items-center rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

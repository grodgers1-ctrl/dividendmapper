import Link from "next/link";

// Replaces the score chips for Free-tier users. Mirrors the pricingPublic
// gating used elsewhere on the portfolio page (page.tsx hidden-rows banner):
// when pricing isn't public yet we show a static tag rather than a dead link.
export function UpgradePill({ pricingPublic }: { pricingPublic: boolean }) {
  if (pricingPublic) {
    return (
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-400/30 dark:bg-brand-900/20 dark:text-brand-300"
      >
        Upgrade to Pro
        <span aria-hidden>→</span>
      </Link>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      Pro
    </span>
  );
}

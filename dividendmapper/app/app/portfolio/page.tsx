import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { isPricingPublic } from "@/lib/flags/pricing";
import { isBeta } from "@/lib/scoring/config";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { formatMoney } from "@/lib/portfolio/format-money";
import { HoldingsTable } from "./_components/holdings-table";
import { AddHoldingLauncher } from "./_components/add-holding-launcher";
import { PortfolioIncomeChart } from "./_components/portfolio-income-chart";
import { FREE_TIER_LIMIT } from "./_components/free-tier-copy";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

// app/app/layout.tsx already gates via requireUser(). Force dynamic so the
// server-side holdings query runs on every request. The page is per-user
// and never cacheable.
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  // Guard here too: a soft nav re-renders only this segment, so the layout's
  // requireUser() may not re-run. requireUser redirects on a null session
  // (cache()-memoised, so free on a full load).
  const user = await requireUser("/app/portfolio");
  const pricingPublic = isPricingPublic();

  const {
    tier,
    total,
    visibleRows,
    hiddenCount,
    atFreeLimit,
    holdingsError,
    quotesByTicker,
    actualsByKey,
    priceByTicker,
    valueTotalsByCurrency,
    income,
  } = await loadPricedHoldings(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your portfolio
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {total === 0
              ? "Add your holdings one at a time. Broker sync ships in Phase 3."
              : `${total} holding${total === 1 ? "" : "s"} · ${
                  tier === "free"
                    ? `${Math.min(total, FREE_TIER_LIMIT)}/${FREE_TIER_LIMIT} on Free`
                    : "Pro · unlimited"
                }`}
          </p>
        </div>
        <AddHoldingLauncher
          atFreeLimit={atFreeLimit}
          pricingPublic={pricingPublic}
        />
      </div>

      <div className="mt-8">
        {holdingsError ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              We couldn&apos;t load your holdings
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Refresh the page to try again. If this keeps happening, sign out
              and back in.
            </p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              No holdings yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Add your first holding to see it here. Ticker, quantity, cost
              basis, and the wrapper it sits in. Everything else comes from
              market data.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {hiddenCount > 0 && (
              <div
                role="status"
                className="rounded-lg border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
              >
                <p className="font-display text-sm font-semibold">
                  {hiddenCount} holding{hiddenCount === 1 ? "" : "s"} hidden
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Free shows your {FREE_TIER_LIMIT} most recent holdings in the
                  table. Your income below counts all {total}. Upgrade to Pro
                  to see them all.
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
            <HoldingsTable
              rows={visibleRows}
              quotes={quotesByTicker}
              actualsByKey={actualsByKey}
              priceByTicker={priceByTicker}
              tier={tier}
              pricingPublic={pricingPublic}
              isBeta={isBeta()}
              scoresByTicker={{}}
              showScores={tier === "free"}
            />
            {valueTotalsByCurrency.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Estimated portfolio value:{" "}
                <span className="font-mono font-medium text-foreground">
                  {valueTotalsByCurrency
                    .map((v) => formatMoney(v.total, v.currency))
                    .join(" · ")}
                </span>
              </p>
            )}
            <PortfolioIncomeChart income={income} />
          </div>
        )}
      </div>
    </div>
  );
}

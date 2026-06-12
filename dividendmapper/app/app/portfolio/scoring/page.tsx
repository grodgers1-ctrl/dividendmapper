import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isPricingPublic } from "@/lib/flags/pricing";
import { isBeta } from "@/lib/scoring/config";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { loadPortfolioAnalytics } from "@/lib/scoring/load-portfolio-analytics";
import { loadUserPreferences } from "@/lib/scoring/preferences";
import { buildQuadrant } from "@/lib/scoring/quadrant";
import { HoldingsTable } from "../_components/holdings-table";
import { PortfolioInsights } from "../_components/portfolio-insights";
import { ReinvestCard } from "../_components/reinvest-card";
import { QuadrantMap } from "../_components/quadrant-map";
import { ScoreLensToggle } from "../_components/score-lens-toggle";
import { FirstVisitWizard } from "../_components/first-visit-wizard";
import { RefreshScoresButton } from "../_components/refresh-scores-button";

export const metadata: Metadata = {
  title: "Portfolio Manager",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortfolioManagerPage(props: {
  searchParams: Promise<{ lens?: string }>;
}) {
  // Guard here too: a soft nav re-renders only this segment, so the layout's
  // requireUser() may not re-run. requireUser redirects on a null session
  // (cache()-memoised, so free on a full load).
  const user = await requireUser("/app/portfolio/scoring");
  const priced = await loadPricedHoldings(user.id);

  // Pro+ only. Free users are redirected back to the ledger.
  if (priced.tier === "free") redirect("/app/portfolio");

  const sp = await props.searchParams;
  const lens = sp.lens === "1";
  const prefs = await loadUserPreferences(user.id);
  const hasAnsweredWizard = !!(prefs?.wizard_completed_at || prefs?.wizard_skipped_at);

  const pricingPublic = isPricingPublic();
  const { visibleRows, quotesByTicker, actualsByKey, priceByTicker, nameByTicker, allHoldings, quotes } = priced;

  const analytics =
    visibleRows.length > 0
      ? await loadPortfolioAnalytics({
          userId: user.id,
          allHoldings,
          visibleRows,
          quotes,
          quotesByTicker,
          lens,
        })
      : null;

  // Pass the full distinct ticker list (not just scored ones) so a just-added
  // holding with no score row yet shows as "Collecting…" instead of vanishing.
  const distinctTickers = [...new Set(visibleRows.map((h) => h.ticker))];
  const quadrant = buildQuadrant(
    distinctTickers,
    analytics?.scoresByTicker ?? {},
    analytics?.weightByTicker ?? {},
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <FirstVisitWizard initial={prefs} autoOpen={!hasAnsweredWizard} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Portfolio Manager
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Quality, Trim and Risk across your holdings. Signals are a resilience
            check, not a buy recommendation. Not financial advice.
          </p>
        </div>
        <RefreshScoresButton />
      </div>

      <div className="mt-8 space-y-6">
        {visibleRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              No holdings to analyse yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Add holdings on the Ledger and their scores appear here after the
              nightly update.
            </p>
          </div>
        ) : (
          <>
            {analytics?.reinvestCard && (
              <ReinvestCard
                trigger={analytics.reinvestCard.trigger}
                candidates={analytics.reinvestCard.candidates}
              />
            )}
            {analytics && (
              <PortfolioInsights
                flagged={analytics.flagged}
                overweight={analytics.concentration.overweight}
                threshold={analytics.concentration.threshold}
              />
            )}
            {prefs && (
              <div className="flex justify-end">
                <ScoreLensToggle on={lens} />
              </div>
            )}
            <HoldingsTable
              rows={visibleRows}
              quotes={quotesByTicker}
              actualsByKey={actualsByKey}
              priceByTicker={priceByTicker}
              nameByTicker={nameByTicker}
              tier={priced.tier}
              pricingPublic={pricingPublic}
              isBeta={isBeta()}
              scoresByTicker={analytics?.scoresByTicker ?? {}}
              showScores={true}
            />
            <QuadrantMap
              points={quadrant.points}
              excluded={quadrant.excluded}
              isBeta={isBeta()}
            />
          </>
        )}
      </div>
    </div>
  );
}

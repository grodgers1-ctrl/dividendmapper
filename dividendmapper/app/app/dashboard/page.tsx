import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { sumIncomeGbp } from "@/lib/portfolio/income";
import { aggregatePortfolioCost, sumCostGbp } from "@/lib/portfolio/portfolio-cost";
import { loadPortfolioAnalytics } from "@/lib/scoring/load-portfolio-analytics";
import { loadScore } from "@/lib/scoring/load-score";
import { loadVehicleScoresByTickers, type VehicleType } from "@/lib/scoring/load-vehicle-score";
import { aggregateIncomeByBand } from "@/lib/portfolio/anchors-exposures";
import { ratesToGbpFor } from "@/lib/scoring/currency";
import { buildQuadrant } from "@/lib/scoring/quadrant";
import { isBeta } from "@/lib/scoring/config";
import { pickFlaggedHolding, type FlaggableScore } from "@/lib/scoring/pick-flagged";
import { AnchorsExposuresCard } from "./_components/AnchorsExposuresCard";
import { PageHeader } from "../_components/page-header/page-header";
import { HeroIncomeCard } from "./_components/HeroIncomeCard";
import { TopHoldingsStrip } from "./_components/TopHoldingsStrip";
import { UpgradeCard } from "./_components/UpgradeCard";
import { FlaggedHoldingCard } from "./_components/FlaggedHoldingCard";
import { QuadrantSnapshotCard } from "./_components/QuadrantSnapshotCard";
import { IncomeCalendarCard } from "./_components/IncomeCalendarCard";
import { ValueVsCostCard } from "./_components/ValueVsCostCard";
import { SectorExposureCard } from "./_components/SectorExposureCard";
import { BestWorstCard } from "./_components/BestWorstCard";
import { rollupSectors } from "@/lib/portfolio/sector-exposure";
import { computeHoldingsPnl } from "@/lib/portfolio/holding-pnl";
import type { SignalContributionRow } from "@/app/app/portfolio/[ticker]/_components/SignalContributionsList";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// Per [[reference_app_page_auth_guard]]: each protected page calls
// requireUser() itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/app/dashboard");

  const priced = await loadPricedHoldings(user.id);
  const {
    tier,
    allHoldings,
    visibleRows,
    quotes,
    quotesByTicker,
    priceByTicker,
    nameByTicker,
    actualsByKey,
    income,
  } = priced;

  const isPro = tier !== "free";

  // Scores + reinvest card + quadrant points are Pro-only. Free path skips
  // the analytics query entirely (it's the heaviest server call).
  const analytics = isPro
    ? await loadPortfolioAnalytics({
        userId: user.id,
        allHoldings,
        visibleRows,
        quotes,
        quotesByTicker,
      })
    : null;

  const scoresMap = new Map<string, FlaggableScore>();
  if (analytics) {
    for (const [ticker, s] of Object.entries(analytics.scoresByTicker)) {
      scoresMap.set(ticker, { ticker, buy: s.buy, risk: s.risk });
    }
  }

  // Pro-only derivations. Quadrant uses the same builder as the full
  // Portfolio Manager page so the snapshot matches what users see there.
  const flaggedTicker = analytics
    ? pickFlaggedHolding(allHoldings, scoresMap)
    : null;
  const flaggedScore =
    analytics && flaggedTicker
      ? (analytics.scoresByTicker[flaggedTicker] ?? null)
      : null;

  // Top-3 most-negative Buy/Quality signals for the flagged ticker.
  // equity_score_signals already holds these per ticker; loadScore() reads
  // the same rows the per-ticker drawer uses. One extra lookup per render —
  // skipped entirely when no holding is flagged.
  let flaggedTopSignals: SignalContributionRow[] = [];
  if (flaggedTicker) {
    const supabase = await createSupabaseServerClient();
    const flaggedScoreFull = await loadScore(supabase, flaggedTicker);
    flaggedTopSignals = (flaggedScoreFull?.signals.buy ?? [])
      .filter((s) => (s.contribution ?? 0) < 0)
      .sort((a, b) => (a.contribution ?? 0) - (b.contribution ?? 0))
      .slice(0, 3);
  }

  const quadrant = analytics
    ? buildQuadrant(
        [...new Set(allHoldings.map((h) => h.ticker))],
        analytics.scoresByTicker,
        analytics.weightByTicker,
      )
    : { points: [], excluded: [] };

  // FX-convert per-currency income totals AND priced holdings to GBP.
  // Collecting the union of currencies in one pass means one ratesToGbpFor
  // call serves the hero, the TopHoldingsStrip sort, and the cost-basis card.
  // cost_currency is unioned too — a holding can carry a cost currency no
  // other path needed (e.g. GBP cost on a US ADR); without this, the cost
  // rollup would silently drop it.
  const distinctCurrencies = new Set<string>();
  for (const t of income.totalsByCurrency) distinctCurrencies.add(t.currency);
  for (const ticker of Object.keys(priceByTicker)) {
    const c = priceByTicker[ticker]?.currency;
    if (c) distinctCurrencies.add(c);
  }
  for (const h of allHoldings) distinctCurrencies.add(h.cost_currency);
  const ratesToGbp = await ratesToGbpFor([...distinctCurrencies]);

  const incomeAnnualGbp = sumIncomeGbp(income.totalsByCurrency, ratesToGbp);
  const costAggregate = aggregatePortfolioCost(allHoldings);
  const totalCostGbpRaw = sumCostGbp(costAggregate.totalsByCurrency, ratesToGbp);
  const totalCostGbp = totalCostGbpRaw > 0 ? totalCostGbpRaw : null;
  // sumIncomeGbp's shape matches ValueCurrencyTotal exactly — same FX rule.
  const totalValueGbp = sumIncomeGbp(priced.valueTotalsByCurrency, ratesToGbp);

  // Sector rollup (Pro only — Free skips analytics entirely).
  const sectorByTicker: Record<string, string | null> = {};
  if (analytics) {
    for (const [ticker, f] of Object.entries(analytics.fundamentalsByTicker)) {
      sectorByTicker[ticker] = f.sector;
    }
  }
  const sectorRollup = analytics
    ? rollupSectors({
        weightByTicker: analytics.weightByTicker,
        sectorByTicker,
      })
    : null;

  // Per-holding lifetime P/L in GBP — drives the BestWorstCard at the foot of
  // the Pro grid. Pure pass over already-loaded holdings + prices + FX rates.
  // Free path skips: cost data is often incomplete and the card is Pro-gated.
  const holdingPnls = isPro
    ? computeHoldingsPnl(allHoldings, priceByTicker, ratesToGbp)
    : [];

  // Anchors vs Exposures — Pro-gated card under the hero. One round-trip for
  // vehicle scores joined to the user's distinct ticker list, then a pure
  // bucket-by-band aggregation against the forward-income figures already
  // resolved per row on the holdings table.
  const distinctTickers = [...new Set(allHoldings.map((h) => h.ticker))];
  const vehicleScoresByTicker: Record<
    string,
    {
      vehicleType: VehicleType;
      resilienceScore: number | null;
      qualityGatePassed: boolean;
    }
  > = {};
  if (isPro && distinctTickers.length > 0) {
    const supabase = await createSupabaseServerClient();
    const vehicleMap = await loadVehicleScoresByTickers(supabase, distinctTickers);
    for (const [ticker, v] of vehicleMap) {
      vehicleScoresByTicker[ticker] = {
        vehicleType: v.vehicleType,
        resilienceScore: v.resilienceScore,
        qualityGatePassed: v.qualityGatePassed,
      };
    }
  }
  const anchorsExposures =
    isPro && analytics
      ? aggregateIncomeByBand({
          holdings: allHoldings,
          quotes: quotesByTicker,
          actualsByKey,
          scoresByTicker: analytics.scoresByTicker,
          vehicleScoresByTicker,
          ratesToGbp,
        })
      : null;

  const beta = isBeta();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <PageHeader
        title="Dashboard"
        subtitle="Your portfolio at a glance"
        betaPill={isPro}
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Row 1 — hero income + (Pro: flagged / Free: upgrade) */}
        <div className="col-span-12 md:col-span-8">
          <HeroIncomeCard
            incomeAnnualGbp={incomeAnnualGbp}
            totalCostGbp={totalCostGbp}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          {isPro ? (
            <FlaggedHoldingCard
              flaggedTicker={flaggedTicker}
              score={flaggedScore}
              isBeta={beta}
              topSignals={flaggedTopSignals}
            />
          ) : (
            <UpgradeCard />
          )}
        </div>

        {/* Row 1.5 — Anchors vs Exposures (Pro). Reads off forward annual
            income with the same source-of-truth as the Ledger Income column.
            Free users keep the UpgradeCard above; no second upsell here. */}
        {isPro && anchorsExposures && (
          <div className="col-span-12">
            <AnchorsExposuresCard
              totalsGbp={anchorsExposures.totalsGbp}
              countsByBand={anchorsExposures.countsByBand}
            />
          </div>
        )}

        {/* Row 2 — Value vs Cost (Free + Pro). Pro pairs it with Sector
            Exposure on the right; Free renders the full width. */}
        <div className="col-span-12 md:col-span-4">
          <ValueVsCostCard
            valueGbp={totalValueGbp}
            costGbp={totalCostGbp ?? 0}
          />
        </div>
        {isPro && sectorRollup && (
          <div className="col-span-12 md:col-span-8">
            <SectorExposureCard rollup={sectorRollup} />
          </div>
        )}

        {/* Row 3 — Pro: quadrant + reinvest planner; Free omitted entirely */}
        {isPro && (
          <>
            <div className="col-span-12 md:col-span-8">
              <QuadrantSnapshotCard
                points={quadrant.points}
                excluded={quadrant.excluded}
                isBeta={beta}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              {analytics && (
                <IncomeCalendarCard
                  calendar={analytics.incomeCalendar}
                  reinvestCard={analytics.reinvestCard}
                />
              )}
            </div>
          </>
        )}

        {/* Row 3 — top 5 holdings, both tiers */}
        <div className="col-span-12">
          <TopHoldingsStrip
            holdings={allHoldings}
            priceByTicker={priceByTicker}
            nameByTicker={nameByTicker}
            scores={scoresMap}
            tier={tier}
            ratesToGbp={ratesToGbp}
            fundamentalsByTicker={analytics?.fundamentalsByTicker}
          />
        </div>

        {/* Row 4 — Pro best/worst lifetime P/L. Sits under TopHoldingsStrip
            because "look at these specifically" cues naturally land here. */}
        {isPro && (
          <div className="col-span-12">
            <BestWorstCard pnls={holdingPnls} />
          </div>
        )}
      </div>
    </div>
  );
}

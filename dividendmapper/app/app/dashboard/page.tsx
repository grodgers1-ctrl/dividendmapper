import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { loadPortfolioAnalytics } from "@/lib/scoring/load-portfolio-analytics";
import { buildQuadrant } from "@/lib/scoring/quadrant";
import { isBeta } from "@/lib/scoring/config";
import { pickFlaggedHolding, type FlaggableScore } from "@/lib/scoring/pick-flagged";
import { PageHeader } from "../_components/page-header/page-header";
import { HeroIncomeCard } from "./_components/HeroIncomeCard";
import { TopHoldingsStrip } from "./_components/TopHoldingsStrip";
import { UpgradeCard } from "./_components/UpgradeCard";
import { FlaggedHoldingCard } from "./_components/FlaggedHoldingCard";
import { QuadrantSnapshotCard } from "./_components/QuadrantSnapshotCard";
import { ReinvestStripCard } from "./_components/ReinvestStripCard";
import type { RidgePoint } from "./_components/RidgeSparkline";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// Per [[reference_app_page_auth_guard]]: each protected page calls
// requireUser() itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

// Naïve cross-currency sum: matches the Portfolio Ledger's display behaviour
// (its totalsByCurrency rows aren't FX-converted either). Phase 4 will plug
// in `ratesToGbpFor()` once the hero acquires a multi-currency story.
function sumIncomeNaive(totals: { currency: string; total: number }[]): number {
  return totals.reduce((acc, row) => acc + row.total, 0);
}

// Deterministic 12-month ramp from 70% → 100% of the current run-rate.
// Day 6+ replaces this with a real historical series from
// portfolio_income_history once that table starts accruing. For now it gives
// the ridge sparkline a stable shape so the visual is real on Day 5.
function syntheticSparkline(now: Date, annualGbp: number): RidgePoint[] {
  if (annualGbp <= 0) return [];
  const points: RidgePoint[] = [];
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  for (let i = 0; i < 12; i += 1) {
    const at = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const ratio = 0.7 + (i / 11) * 0.3;
    points.push({ at, value: annualGbp * ratio });
  }
  return points;
}

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
  const quadrant = analytics
    ? buildQuadrant(
        [...new Set(allHoldings.map((h) => h.ticker))],
        analytics.scoresByTicker,
        analytics.weightByTicker,
      )
    : { points: [], excluded: [] };

  const incomeAnnualGbp = sumIncomeNaive(income.totalsByCurrency);
  const sparkline = syntheticSparkline(new Date(), incomeAnnualGbp);
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
            sparkline={sparkline}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          {isPro ? (
            <FlaggedHoldingCard
              flaggedTicker={flaggedTicker}
              score={flaggedScore}
              isBeta={beta}
            />
          ) : (
            <UpgradeCard />
          )}
        </div>

        {/* Row 2 — Pro: quadrant + reinvest planner; Free omitted entirely */}
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
              <ReinvestStripCard reinvestCard={analytics?.reinvestCard ?? null} />
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
          />
        </div>
      </div>
    </div>
  );
}

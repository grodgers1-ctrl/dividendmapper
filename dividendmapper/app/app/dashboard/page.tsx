import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { sumIncomeGbp } from "@/lib/portfolio/income";
import { loadPortfolioAnalytics } from "@/lib/scoring/load-portfolio-analytics";
import { loadScore } from "@/lib/scoring/load-score";
import { ratesToGbpFor } from "@/lib/scoring/currency";
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
import type { SignalContributionRow } from "@/app/app/portfolio/[ticker]/_components/SignalContributionsList";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// Per [[reference_app_page_auth_guard]]: each protected page calls
// requireUser() itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

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
  // call serves both the hero and the TopHoldingsStrip sort.
  const distinctCurrencies = new Set<string>();
  for (const t of income.totalsByCurrency) distinctCurrencies.add(t.currency);
  for (const ticker of Object.keys(priceByTicker)) {
    const c = priceByTicker[ticker]?.currency;
    if (c) distinctCurrencies.add(c);
  }
  const ratesToGbp = await ratesToGbpFor([...distinctCurrencies]);

  const incomeAnnualGbp = sumIncomeGbp(income.totalsByCurrency, ratesToGbp);
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
              topSignals={flaggedTopSignals}
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
            ratesToGbp={ratesToGbp}
          />
        </div>
      </div>
    </div>
  );
}

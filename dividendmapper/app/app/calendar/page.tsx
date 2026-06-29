import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { loadCalendarData } from "@/lib/portfolio/load-calendar-data";
import { loadFutureProjectionInputs } from "@/lib/portfolio/load-future-projection-inputs";
import { buildIncomeCalendar } from "@/lib/portfolio/income-calendar";
import type { ProjectionTickerInput } from "@/lib/portfolio/future-projection";
import { aggregatePortfolioValue } from "@/lib/portfolio/portfolio-value";
import { TopographyMotif } from "@/components/visual/topography-motif";
import { PageHeader } from "../_components/page-header/page-header";
import { CalendarShell } from "./_components/calendar-shell";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

// Per [[reference_app_page_auth_guard]]: each protected page calls
// requireUser() itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser("/app/calendar");

  const priced = await loadPricedHoldings(user.id);
  if (priced.tier === "free") {
    redirect("/pricing?from=/app/calendar");
  }

  // TODO Slice B: read locale from user settings. UK default for now.
  const locale = "uk" as const;

  const [
    {
      userDividends,
      exDivByTicker,
      ratesToPrimary,
      projectedNext12mByTicker,
      projectedHistorical12mByTicker,
      nameByTicker,
      cadenceByTicker,
    },
    { growthRateByTicker },
  ] = await Promise.all([
    loadCalendarData(user.id, priced.allHoldings, locale),
    loadFutureProjectionInputs(user.id, priced.allHoldings),
  ]);

  const holdings = priced.allHoldings.map((h) => ({
    ticker: h.ticker,
    quantity: Number(h.quantity),
    wrapper: h.wrapper as never,
    created_at: h.created_at,
  }));

  const forwardDpsByTicker: Record<string, { dps: number; currency: string }> = {};
  for (const [ticker, quote] of Object.entries(priced.quotesByTicker)) {
    if (!quote.ok) continue;
    const { dividend, currency } = quote.data;
    if (typeof dividend === "number" && dividend > 0 && currency) {
      forwardDpsByTicker[ticker] = { dps: dividend, currency };
    }
  }

  const calendar = buildIncomeCalendar({
    userDividends,
    holdings,
    exDivByTicker,
    ratesToGbp: ratesToPrimary,
    now: new Date(),
    locale,
    wrapperFilter: "all",
    projectedNext12mByTicker,
    projectedHistorical12mByTicker,
    nameByTicker,
    cadenceByTicker,
    forwardDpsByTicker,
  });

  // Assemble per-ticker inputs for the future-projection card. dps0 prefers
  // the sum of projected_next_12m_payments (cache); falls back to the FMP
  // forward DPS for newly-initiated payers (source = "fmp-fallback").
  const projectionTickers: ProjectionTickerInput[] = [];
  for (const h of priced.allHoldings) {
    const t = h.ticker;
    const cacheRows = projectedNext12mByTicker[t] ?? [];
    const dpsFromCache = cacheRows.reduce((s, r) => s + (r.per_share_amount ?? 0), 0);
    const cacheCurrency = cacheRows[0]?.currency;
    const fmp = forwardDpsByTicker[t];
    const dps0 = dpsFromCache > 0 ? dpsFromCache : fmp?.dps ?? 0;
    if (dps0 <= 0) continue;
    const dpsCurrency =
      dpsFromCache > 0 ? cacheCurrency ?? "GBP" : fmp?.currency ?? "GBP";
    const price = priced.priceByTicker[t];
    projectionTickers.push({
      ticker: t,
      shares: Number(h.quantity),
      dps0,
      dpsCurrency,
      price0: price?.price ?? null,
      priceCurrency: price?.currency ?? dpsCurrency,
      avgCost: Number(h.avg_cost) ?? 0,
      costCurrency: h.cost_currency ?? "GBP",
      rawCagr: growthRateByTicker[t] ?? 0,
      source: dpsFromCache > 0 ? "cache" : "fmp-fallback",
    });
  }

  // Portfolio value in the user's primary currency, used for the Yield KPI.
  // Pulls per-currency totals from priced.allHoldings × priceByTicker, then
  // converts each currency via ratesToPrimary. null when value can't be
  // computed (e.g. all quotes unavailable).
  const valueTotals = aggregatePortfolioValue(priced.allHoldings, priced.priceByTicker);
  let portfolioValuePrimary: number | null = 0;
  let anyConverted = false;
  for (const { currency, total } of valueTotals.totalsByCurrency) {
    const rate = ratesToPrimary[currency];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      portfolioValuePrimary += total * rate;
      anyConverted = true;
    }
  }
  if (!anyConverted) portfolioValuePrimary = null;

  const sixMoAgo = new Date();
  sixMoAgo.setMonth(sixMoAgo.getMonth() - 6);
  const sixMoAgoIso = sixMoAgo.toISOString().slice(0, 10);
  const pastUserDividendsCount = userDividends.filter((d) => d.paid_on >= sixMoAgoIso).length;

  // Width + padding match the dashboard so the two pages feel like siblings,
  // then ~25% more vertical padding to give the chart's hover tooltip room to
  // land above the top bar. PageHeader gives the StatSidebar a visual anchor
  // and pushes the sidebar card down so it doesn't squash against the top.
  // Topography motif is a subtle echo of the public landing hero.
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-20">
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-[420px] overflow-hidden opacity-60"
        >
          <TopographyMotif intensity="subtle" className="h-full w-full" />
        </div>
        <PageHeader
          title="Calendar"
          subtitle="Past payments and the year ahead"
        />
        <CalendarShell
          locale={locale}
          calendar={calendar}
          userDividends={userDividends}
          ratesToPrimary={ratesToPrimary}
          showEmptyStateCta={pastUserDividendsCount === 0}
          portfolioValuePrimary={portfolioValuePrimary}
          projectionTickers={projectionTickers}
        />
      </div>
    </div>
  );
}

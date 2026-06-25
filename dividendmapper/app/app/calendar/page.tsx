import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { loadCalendarData } from "@/lib/portfolio/load-calendar-data";
import { buildIncomeCalendar } from "@/lib/portfolio/income-calendar";
import { aggregatePortfolioValue } from "@/lib/portfolio/portfolio-value";
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

  const {
    userDividends,
    exDivByTicker,
    ratesToPrimary,
    projectedNext12mByTicker,
    projectedHistorical12mByTicker,
    nameByTicker,
    cadenceByTicker,
  } = await loadCalendarData(user.id, priced.allHoldings, locale);

  const holdings = priced.allHoldings.map((h) => ({
    ticker: h.ticker,
    quantity: Number(h.quantity),
    wrapper: h.wrapper as never,
    created_at: h.created_at,
  }));

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
  });

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

  // No PageHeader: the drawer topbar already labels the route. The StatSidebar
  // serves as the page's own visual anchor.
  return (
    <CalendarShell
      locale={locale}
      calendar={calendar}
      userDividends={userDividends}
      ratesToPrimary={ratesToPrimary}
      showEmptyStateCta={pastUserDividendsCount === 0}
      portfolioValuePrimary={portfolioValuePrimary}
    />
  );
}

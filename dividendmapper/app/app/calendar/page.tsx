import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { loadCalendarData } from "@/lib/portfolio/load-calendar-data";
import { buildIncomeCalendar } from "@/lib/portfolio/income-calendar";
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

  const {
    userDividends,
    exDivByTicker,
    ratesToPrimary,
    projectedNext12mByTicker,
    projectedHistorical12mByTicker,
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
  });

  const sixMoAgo = new Date();
  sixMoAgo.setMonth(sixMoAgo.getMonth() - 6);
  const sixMoAgoIso = sixMoAgo.toISOString().slice(0, 10);
  const pastUserDividendsCount = userDividends.filter((d) => d.paid_on >= sixMoAgoIso).length;

  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarShell
        locale={locale}
        calendar={calendar}
        userDividends={userDividends}
        ratesToPrimary={ratesToPrimary}
        showEmptyStateCta={pastUserDividendsCount === 0}
      />
    </>
  );
}

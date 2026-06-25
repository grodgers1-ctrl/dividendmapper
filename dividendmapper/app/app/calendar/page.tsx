import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
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

  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarShell priced={priced} userId={user.id} />
    </>
  );
}

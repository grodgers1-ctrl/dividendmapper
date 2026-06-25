import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadVehicleUniverse } from "@/lib/scoring/load-vehicle-universe";
import { PageHeader } from "../_components/page-header/page-header";
import { InAppHub } from "./_components/in-app-hub";

export const metadata: Metadata = {
  title: "Income vehicles",
  robots: { index: false, follow: false },
};

// Per app/page auth guard convention — call requireUser() here too because
// soft navs do not re-run the layout guard.
export const dynamic = "force-dynamic";

export default async function AppIncomeVehiclesHubPage() {
  const user = await requireUser("/app/income-vehicles");
  const supabase = await createSupabaseServerClient();

  // Pro+ gate. Free users go to pricing — mirrors the Portfolio Manager
  // page pattern (which redirects to /app/portfolio for free users).
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const tier = (profile?.tier ?? "free") as "free" | "pro" | "premium";
  if (tier === "free") redirect("/pricing");

  const [universe, holdingsResult, trackedResult] = await Promise.all([
    loadVehicleUniverse(supabase),
    supabase
      .from("holdings")
      .select("ticker")
      .is("archived_at", null),
    supabase.from("tracked_tickers").select("ticker"),
  ]);
  const ownedSet = new Set<string>();
  for (const row of (holdingsResult.data ?? []) as { ticker: string }[]) {
    ownedSet.add(row.ticker);
  }
  for (const row of (trackedResult.data ?? []) as { ticker: string }[]) {
    ownedSet.add(row.ticker);
  }
  const ownedTickers = [...ownedSet];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
      <PageHeader
        title="Income vehicles"
        subtitle={`${universe.length} scored vehicles across REITs, BDCs and UK REITs. Filter, search, and pick names that fit your portfolio.`}
        betaPill
      />
      <InAppHub universe={universe} ownedTickers={ownedTickers} />
    </div>
  );
}

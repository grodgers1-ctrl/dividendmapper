import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { loadVehicleUniverse } from "@/lib/scoring/load-vehicle-universe";
import { LeaderboardCard } from "./_components/leaderboard-card";
import { Screener } from "./_components/screener";

// Public hub for vehicle resilience scores. ISR — the universe is rescored
// daily at 09:00 UTC and the page caches for an hour at the edge.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Income vehicle resilience scores",
  description:
    "REITs, BDCs and UK REITs ranked by dividend resilience. Quality gates, payout cover, leverage, sub-sector concentration and recent dividend behaviour, scored daily. Informational only, not financial advice.",
  alternates: { canonical: "/income-vehicles" },
  openGraph: {
    title: "Income vehicle resilience scores | DividendMapper",
    description:
      "REITs, BDCs and UK REITs ranked by dividend resilience.",
    url: `${SITE_URL}/income-vehicles`,
  },
};

export default async function IncomeVehiclesHubPage() {
  const supabase = createSupabasePublicClient();
  const universe = await loadVehicleUniverse(supabase);
  const totalCount = universe.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Income vehicles, ranked by dividend resilience
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          REITs, BDCs and UK REITs — scored daily on payout cover, leverage,
          concentration and recent dividend behaviour. Informational only, not
          financial advice.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {totalCount} scored vehicles · 3 families · updated daily at 09:00 UTC
        </p>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <LeaderboardCard vehicleType="us_reit" universe={universe} topN={10} />
        <LeaderboardCard vehicleType="us_bdc" universe={universe} topN={10} />
        <LeaderboardCard vehicleType="uk_reit" universe={universe} topN={10} />
      </div>

      <Screener universe={universe} />

      {/* Pro CTA tile — static, ISR-safe (same HTML for every visitor). The
          Pro-only screener at /app/income-vehicles unlocks saved screens,
          holdings/watchlist toggle, and the per-signal Resilience breakdown. */}
      <section
        aria-label="Pro upgrade prompt"
        className="mt-8 rounded-xl border border-border bg-secondary/30 p-5"
      >
        <h2 className="font-display text-base font-semibold text-foreground">
          Want saved screens + the per-signal breakdown?
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pro unlocks the in-app screener at /app/income-vehicles, the full
          per-signal Resilience breakdown on every ticker, saved filter
          combinations, and the holdings-only toggle.
        </p>
        <Link
          href="/pricing"
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          See Pro →
        </Link>
      </section>
    </div>
  );
}

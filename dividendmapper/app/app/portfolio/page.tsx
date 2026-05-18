import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPortfolioIncome } from "@/lib/portfolio/income";
import { HoldingsTable } from "./_components/holdings-table";
import { AddHoldingLauncher } from "./_components/add-holding-launcher";
import { PortfolioIncomeChart } from "./_components/portfolio-income-chart";
import { FREE_TIER_LIMIT } from "./_components/free-tier-copy";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

// app/app/layout.tsx already gates via requireUser(). Force dynamic so the
// server-side holdings query runs on every request — the page is per-user
// and never cacheable.
export const dynamic = "force-dynamic";

type HoldingRow = {
  id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  wrapper: string;
  broker_label: string | null;
  notes: string | null;
  created_at: string;
};

export default async function PortfolioPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createSupabaseServerClient();

  // Profile + income roll-up run in parallel — income reads ALL holdings
  // (no tier cap, see getPortfolioIncome) so it doesn't need the tier to
  // start. The holdings-table query waits on the tier so we can apply the
  // free-tier limit server-side.
  const [profileResult, income] = await Promise.all([
    supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .maybeSingle<{ tier: "free" | "pro" | "premium" }>(),
    getPortfolioIncome(user.id),
  ]);

  const tier = profileResult.data?.tier ?? "free";

  let holdingsQuery = supabase
    .from("holdings")
    .select(
      "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (tier === "free") {
    holdingsQuery = holdingsQuery.limit(FREE_TIER_LIMIT);
  }

  const {
    data: holdings,
    count: totalHoldings,
    error: holdingsError,
  } = await holdingsQuery.returns<HoldingRow[]>();

  const rows = holdings ?? [];
  const total = totalHoldings ?? rows.length;
  const atFreeLimit = tier === "free" && total >= FREE_TIER_LIMIT;
  const hiddenCount = tier === "free" ? Math.max(0, total - FREE_TIER_LIMIT) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your portfolio
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {total === 0
              ? "Add your holdings one at a time. Broker sync ships in Phase 3."
              : `${total} holding${total === 1 ? "" : "s"} · ${
                  tier === "free"
                    ? `${Math.min(total, FREE_TIER_LIMIT)}/${FREE_TIER_LIMIT} on Free`
                    : "Pro — unlimited"
                }`}
          </p>
        </div>
        <AddHoldingLauncher atFreeLimit={atFreeLimit} />
      </div>

      <div className="mt-8">
        {holdingsError ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              We couldn&apos;t load your holdings
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Refresh the page to try again. If this keeps happening, sign out
              and back in.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              No holdings yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Add your first holding to see it here. Ticker, quantity, cost
              basis, and the wrapper it sits in — everything else comes from
              market data.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {hiddenCount > 0 && (
              <div
                role="status"
                className="rounded-lg border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
              >
                <p className="font-display text-sm font-semibold">
                  {hiddenCount} holding{hiddenCount === 1 ? "" : "s"} hidden
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Free shows your {FREE_TIER_LIMIT} most recent holdings in the
                  table. Your income below counts all {total}. Upgrade to Pro
                  to see them all.
                </p>
              </div>
            )}
            <HoldingsTable rows={rows} />
            <PortfolioIncomeChart income={income} />
          </div>
        )}
      </div>
    </div>
  );
}

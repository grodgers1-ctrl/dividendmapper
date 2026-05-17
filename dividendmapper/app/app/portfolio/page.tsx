import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HoldingsTable } from "./_components/holdings-table";
import { AddHoldingLauncher } from "./_components/add-holding-launcher";

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

  const { data: holdings } = await supabase
    .from("holdings")
    .select(
      "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<HoldingRow[]>();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();

  const tier = profile?.tier ?? "free";
  const rows = holdings ?? [];
  const atFreeLimit = tier === "free" && rows.length >= 10;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your portfolio
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {rows.length === 0
              ? "Add your holdings one at a time. Broker sync ships in Phase 3."
              : `${rows.length} holding${rows.length === 1 ? "" : "s"} · ${tier === "free" ? `${rows.length}/10 on Free` : "Pro — unlimited"}`}
          </p>
        </div>
        <AddHoldingLauncher atFreeLimit={atFreeLimit} />
      </div>

      <div className="mt-8">
        {rows.length === 0 ? (
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
          <HoldingsTable rows={rows} />
        )}
      </div>
    </div>
  );
}

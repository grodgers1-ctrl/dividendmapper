import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { loadScore } from "@/lib/scoring/load-score";
import { primaryGateReason } from "@/lib/scoring/gate-reasons";
import type { GateCode } from "@/lib/scoring/quality-gates";
import { isBeta } from "@/lib/scoring/config";
import { PageHeader } from "../../_components/page-header/page-header";
import { WatchlistPanel, type WatchRow } from "../_components/watchlist-panel";
import { RefreshScoresButton } from "../_components/refresh-scores-button";

export const metadata: Metadata = {
  title: "Watchlist",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  // Guard here too: a soft nav re-renders only this segment, so the layout's
  // requireUser() may not re-run.
  const user = await requireUser("/app/portfolio/watchlist");

  const supabase = await createSupabaseServerClient();

  // Pro+ only. Free users are redirected back to the ledger.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  if ((profile?.tier ?? "free") === "free") redirect("/app/portfolio");

  // RLS scopes these to the current user.
  const { data: tracked } = await supabase
    .from("tracked_tickers")
    .select("id, ticker")
    .order("added_at", { ascending: true });
  const trackedRows = (tracked ?? []) as { id: string; ticker: string }[];

  // Scores are public (equity_scores is publicly readable, like /scoring/[ticker]);
  // the cookieless public client keeps this query off the auth path.
  const publicClient = createSupabasePublicClient();
  const rows: WatchRow[] = await Promise.all(
    trackedRows.map(async (t): Promise<WatchRow> => {
      const score = await loadScore(publicClient, t.ticker).catch(() => null);
      return {
        id: t.id,
        ticker: t.ticker,
        buyScore: score?.buyScore ?? null,
        trimScore: score?.trimScore ?? null,
        riskScore: score?.riskScore ?? null,
        buyGateReason: score
          ? primaryGateReason((score.buyFailedGates ?? []) as GateCode[])
          : null,
        scored: score !== null,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <PageHeader
        title="Watchlist"
        subtitle="Track tickers you don't own yet. They're scored in the nightly update alongside your holdings. Signals are a resilience check, not a buy recommendation. Not financial advice."
        actions={<RefreshScoresButton />}
      />

      <div>
        <WatchlistPanel rows={rows} isBeta={isBeta()} />
      </div>
    </div>
  );
}

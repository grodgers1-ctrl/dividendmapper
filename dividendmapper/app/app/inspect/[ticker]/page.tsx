import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTicker } from "@/lib/scoring/load-score";
import {
  loadInspectBundleResult,
  loadInspectProfile,
  type LoadResult,
} from "@/app/(public)/inspect/_shared/load-inspect-page-data";
import { InspectTickerBody } from "@/app/(public)/inspect/_shared/inspect-ticker-body";
import { EtfInspectBody } from "@/app/(public)/inspect/_components/etf-inspect-body";

// In-app mirror of /inspect/[ticker]. Same body, rendered inside DrawerShell
// (the /app layout owns the sidebar + topbar chrome). Reading the user's
// real tier lets the upsell card show the right CTA — anon copy on the
// public surface, free → upgrade-to-Pro here, Pro → no card.
export const metadata: Metadata = {
  title: "Inspect",
};

export const dynamic = "force-dynamic";

export default async function AppInspectTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();

  // Per [[reference_app_page_auth_guard]]: each protected page calls
  // requireUser() itself because layout guards don't re-run on soft navs.
  const user = await requireUser(`/app/inspect/${ticker}`);

  // Hoisted: reused for the asset_type branch and the tier lookup below so
  // we don't double-instantiate the server client per request.
  const supabase = await createSupabaseServerClient();

  // ETF branch: when tickers.asset_type='etf', skip the equity bundle fetch
  // entirely and render the dedicated ETF body. /app shell chrome (drawer +
  // topbar) wraps it via the layout — no per-page chrome needed.
  const { data: tickerRow } = await supabase
    .from("tickers")
    .select("asset_type")
    .eq("ticker", ticker)
    .maybeSingle<{ asset_type: string }>();
  if (tickerRow?.asset_type === "etf") {
    return <EtfInspectBody ticker={ticker} />;
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const dbTier = profileRow?.tier ?? "free";
  // Upsell card only distinguishes anon / free / pro. Treat any non-free
  // tier (pro, premium, founding-member-as-pro) as Pro for upsell purposes.
  const tier: "free" | "pro" = dbTier === "free" ? "free" : "pro";

  const [result, profile] = await Promise.all([
    loadInspectBundleResult(ticker).catch((): LoadResult | null => null),
    loadInspectProfile(ticker),
  ]);

  return (
    <InspectTickerBody
      ticker={ticker}
      result={result ?? { ok: false, reason: "uncoverable" }}
      profile={profile}
      tier={tier}
      backHref="/app/inspect"
      chrome="app"
    />
  );
}

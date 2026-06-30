import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTicker } from "@/lib/scoring/load-score";
import {
  loadInspectBundleResult,
  loadInspectProfile,
  type LoadResult,
} from "../_shared/load-inspect-page-data";
import { InspectTickerBody } from "../_shared/inspect-ticker-body";
import { EtfInspectBody } from "../_components/etf-inspect-body";

// Inspect bundles refresh nightly via the API route's fall-through to FMP.
// An hour of ISR keeps the page cheap to crawl, and the cached HTML serves
// anonymous traffic without paying the API's rate-limit cost.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) return {};
  const result = await loadInspectBundleResult(ticker).catch(() => null);
  if (!result || !result.ok) {
    return {
      title: `Inspect ${ticker}`,
      robots: { index: false, follow: true },
    };
  }
  return {
    title: `${ticker} valuation, safety, growth and profitability history`,
    description: `Ten-year history of valuation, safety, growth and profitability for ${ticker}, with percentile bands. Informational, not financial advice.`,
    alternates: { canonical: `/inspect/${ticker}` },
    openGraph: {
      title: `${ticker} inspect`,
      description: `Ten-year valuation, safety, growth and profitability history for ${ticker}.`,
      url: `${SITE_URL}/inspect/${ticker}`,
    },
  };
}

export default async function InspectTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();

  // ETF branch: when tickers.asset_type='etf', skip the equity bundle fetch
  // entirely and render the dedicated ETF body. Single extra round-trip per
  // page load; still ISR-cacheable (no auth in this lookup).
  const sb = await createSupabaseServerClient();
  const { data: tickerRow } = await sb
    .from("tickers")
    .select("asset_type")
    .eq("ticker", ticker)
    .maybeSingle<{ asset_type: string }>();
  if (tickerRow?.asset_type === "etf") {
    return <EtfInspectBody ticker={ticker} />;
  }

  const [result, profile] = await Promise.all([
    loadInspectBundleResult(ticker).catch((): LoadResult | null => null),
    loadInspectProfile(ticker),
  ]);

  // Upsell card is hard-coded to "anon" because this page is statically
  // rendered for SEO + anon ISR; reading auth would force it dynamic. The
  // /app/inspect/[ticker] mirror passes the real tier instead.
  return (
    <InspectTickerBody
      ticker={ticker}
      result={result ?? { ok: false, reason: "uncoverable" }}
      profile={profile}
      tier="anon"
      backHref="/inspect"
      chrome="public"
    />
  );
}

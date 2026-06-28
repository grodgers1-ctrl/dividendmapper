import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { InspectLandingBody } from "./_shared/inspect-landing-body";

// Trending list comes from the last 24h of lookups (see lib/inspect/trending-tickers).
// Rebuilding every 10 minutes keeps the chip row warm without hammering the DB.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Inspect a stock",
  description:
    "Pull ten years of valuation, safety, growth and profitability history on any UK or US share. Percentile bands show where today sits in its own range. Informational only, not financial advice.",
  alternates: { canonical: "/inspect" },
  openGraph: {
    title: "Inspect a stock | DividendMapper",
    description:
      "Ten years of valuation, safety, growth and profitability history for any UK or US share.",
    url: `${SITE_URL}/inspect`,
  },
};

export default async function InspectIndexPage() {
  return <InspectLandingBody tickerHrefPrefix="/inspect" chrome="public" />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  loadVehicleScore,
  loadVehicleScoreHistory,
  normalizeTicker,
} from "@/lib/scoring/load-vehicle-score";
import { vehiclePublicSummary } from "@/lib/scoring/vehicle-public-summary";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";
import { VehiclePageTemplate } from "../../_components/vehicle-page-template";
import { VehicleProDetail } from "../../_components/vehicle-pro-detail";
import { JsonLdFinancialProduct } from "../../_components/jsonld-financial-product";

export const revalidate = 3600;
export const dynamicParams = true;

const family = VEHICLE_FAMILIES.us_bdc;

const getScore = cache((ticker: string) =>
  loadVehicleScore(createSupabasePublicClient(), ticker),
);
const getHistory = cache((ticker: string) =>
  loadVehicleScoreHistory(createSupabasePublicClient(), ticker, 365 * 5),
);

export async function generateStaticParams(): Promise<{ ticker: string }[]> {
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("vehicle_scores")
      .select("ticker")
      .eq("vehicle_type", family.vehicleType);
    return (data ?? []).map((r) => ({ ticker: (r as { ticker: string }).ticker }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) return {};
  const score = await getScore(ticker).catch(() => null);
  if (!score || score.vehicleType !== family.vehicleType) {
    return { title: "Vehicle not scored", robots: { index: false, follow: true } };
  }
  const { headline } = vehiclePublicSummary(score);
  const description =
    headline.length <= 158
      ? headline
      : `${score.displayName} dividend Resilience score.`;
  return {
    title: `${ticker} (${score.displayName}) — BDC Dividend Resilience`,
    description,
    alternates: { canonical: `/bdcs/${ticker}` },
    openGraph: {
      title: `${ticker} dividend Resilience score`,
      description: headline,
      url: `${SITE_URL}/bdcs/${ticker}`,
    },
  };
}

export default async function BdcTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();
  const [score, history] = await Promise.all([
    getScore(ticker).catch(() => null),
    getHistory(ticker).catch(() => []),
  ]);
  if (!score || score.vehicleType !== family.vehicleType) notFound();

  return (
    <>
      <JsonLdFinancialProduct
        ticker={ticker}
        displayName={score.displayName}
        category="BDC"
        description={`${score.displayName} dividend Resilience score (informational).`}
        url={`${SITE_URL}/bdcs/${ticker}`}
        breadcrumb={[
          { name: "US BDCs", url: `${SITE_URL}/bdcs` },
          { name: ticker, url: `${SITE_URL}/bdcs/${ticker}` },
        ]}
      />
      <VehiclePageTemplate
        score={score}
        family={family}
        navHistory={history}
        proSlot={<VehicleProDetail ticker={ticker} vehicleType="us_bdc" />}
      />
    </>
  );
}

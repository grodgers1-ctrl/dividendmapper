import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadVehicleScore,
  loadVehicleScoreHistory,
  normalizeTicker,
} from "@/lib/scoring/load-vehicle-score";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";
import { VehiclePageTemplate } from "@/app/(public)/_components/vehicle-page-template";
import { VehicleProDetail } from "@/app/(public)/_components/vehicle-pro-detail";

export const metadata: Metadata = {
  title: "Income vehicle detail",
  robots: { index: false, follow: false },
};

// Per app/page auth guard convention — call requireUser() here too because
// soft navs do not re-run the layout guard.
export const dynamic = "force-dynamic";

// In-app peer of /reits/[ticker], /bdcs/[ticker], /uk-reits/[ticker]. Renders
// the same VehiclePageTemplate, but inside the /app drawer shell with the
// breadcrumb pointing back to /app/income-vehicles instead of the public
// family page. Pro-only (free users redirect to /pricing).
export default async function AppIncomeVehicleTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const user = await requireUser("/app/income-vehicles");
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const tier = (profile?.tier ?? "free") as "free" | "pro" | "premium";
  if (tier === "free") redirect("/pricing");

  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();

  const [score, history] = await Promise.all([
    loadVehicleScore(supabase, ticker).catch(() => null),
    loadVehicleScoreHistory(supabase, ticker, 365 * 5).catch(() => []),
  ]);
  if (!score) notFound();
  const family = VEHICLE_FAMILIES[score.vehicleType];

  return (
    <VehiclePageTemplate
      score={score}
      family={family}
      navHistory={history}
      proSlot={<VehicleProDetail ticker={ticker} vehicleType={score.vehicleType} />}
      backHref="/app/income-vehicles"
      backLabel="Income vehicles"
    />
  );
}

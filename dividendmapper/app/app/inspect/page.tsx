import type { Metadata } from "next";
import { InspectLandingBody } from "@/app/(public)/inspect/_shared/inspect-landing-body";

// In-app mirror of /inspect. The /app layout sets robots: noindex globally
// and gates auth via requireUser(), so this page just hands the shared
// body the in-app href prefix so trending chips + search route back into
// /app/inspect/[ticker] (keeping signed-in users inside the app shell).
export const metadata: Metadata = {
  title: "Inspect",
};

// requireUser runs in the /app layout — see app/app/layout.tsx.
export const dynamic = "force-dynamic";

export default async function AppInspectIndexPage() {
  return <InspectLandingBody tickerHrefPrefix="/app/inspect" chrome="app" />;
}

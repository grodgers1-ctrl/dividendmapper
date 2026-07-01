import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { RetirementCalculator } from "@/app/tools/retirement-calculator/_components/retirement-calculator";
import { PageHeader } from "../../_components/page-header/page-header";

// In-app twin of the public /tools/retirement-calculator page. Reuses the same
// calculator island (one source of truth); the sign-in "save inputs" card is
// hidden because the user is already signed in. noindex so it doesn't compete
// with the canonical public page.
export const metadata: Metadata = {
  title: "Retirement calculator",
  robots: { index: false, follow: false },
};

// Per [[reference_app_page_auth_guard]]: each protected page calls
// requireUser() itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

export default async function AppRetirementCalculatorPage() {
  await requireUser("/app/tools/retirement-calculator");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <PageHeader
        title="Retirement calculator"
        subtitle="Project your income to retirement across Bear, Base, and Bull scenarios, with State Pension and lump-sum planning built in."
      />
      <RetirementCalculator showSaveCard={false} />
    </div>
  );
}

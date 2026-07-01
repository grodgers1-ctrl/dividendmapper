import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { DcfCalculator } from "@/app/tools/dcf-calculator/_components/dcf-calculator";
import { PageHeader } from "../../_components/page-header/page-header";

// In-app twin of the public /tools/dcf-calculator page. Reuses the same
// calculator island so there's one source of truth for the model; the only
// difference is the sign-in "save inputs" card is hidden (the user is already
// signed in). noindex so it doesn't compete with the canonical public page.
export const metadata: Metadata = {
  title: "DCF calculator",
  robots: { index: false, follow: false },
};

// Per [[reference_app_page_auth_guard]]: each protected page calls
// requireUser() itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

export default async function AppDcfCalculatorPage() {
  await requireUser("/app/tools/dcf-calculator");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <PageHeader
        title="DCF calculator"
        subtitle="Value any dividend stock with the Gordon Growth model. Three scenarios, a margin-of-safety badge, and a sensitivity table."
      />
      <DcfCalculator showSaveCard={false} />
    </div>
  );
}

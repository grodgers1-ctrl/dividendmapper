import type { Metadata } from "next";
import { LandingHero } from "./_components/landing-hero";
import { DemoCalendar } from "./_components/demo-calendar";
import { FeaturePanels } from "./_components/feature-panels";
import { LandingFaq } from "./_components/landing-faq";

export const metadata: Metadata = {
  title: "Dividend Calendar: see every payment, projected and confirmed",
  description:
    "Track every dividend you'll receive: past, confirmed, and cadence-projected. ISA / SIPP / 401(k) / Roth tax-wrapper-aware. Free preview, Pro for full data.",
  alternates: { canonical: "/dividend-calendar" },
  openGraph: {
    title: "Dividend Calendar | DividendMapper",
    description:
      "Track every dividend, projected and confirmed, in the wrappers you actually hold.",
  },
};

export const revalidate = 3600;

export default function DividendCalendarLanding() {
  return (
    <main>
      <LandingHero />
      <DemoCalendar />
      <FeaturePanels />
      <LandingFaq />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "DividendMapper · Dividend Calendar",
            url: "https://dividendmapper.com/dividend-calendar",
            featureList: [
              "Projected dividend income",
              "Cadence-fill back-projection",
              "Tax-wrapper-aware (ISA, SIPP, 401(k), Roth IRA)",
              "Multi-broker portfolio import",
            ],
          }),
        }}
      />
    </main>
  );
}

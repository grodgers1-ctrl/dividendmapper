import type { Metadata } from "next";
import { RetirementCalculator } from "./_components/retirement-calculator";

export const metadata: Metadata = {
  title: "Retirement Income Calculator UK — ISA, SIPP & GIA",
  description:
    "Free UK retirement income calculator. Project dividend income at retirement across Bear, Base, and Bull scenarios with ISA, SIPP, GIA, and State Pension built in.",
  alternates: { canonical: "/tools/retirement-calculator" },
  openGraph: {
    title: "Retirement Income Calculator — DividendMapper",
    description:
      "Project your dividend income at retirement across three scenarios. UK ISA, SIPP, GIA, and State Pension first-class. Free, no signup.",
    url: "/tools/retirement-calculator",
    type: "website",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Dividend Income Retirement Calculator",
  url: "https://dividendmapper.com/tools/retirement-calculator",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  description:
    "Free retirement income calculator for UK ISA, SIPP and GIA dividend investors. Three-scenario projection (Bear / Base / Bull) with FIRE number, year-by-year chart, and probability-weighted summary.",
};

export default function RetirementCalculatorPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Retirement calculator
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          When can you retire on dividends?
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Three projections — Bear, Base, Bull — alongside a probability-weighted
          average. Built for UK investors using ISA, SIPP, and GIA, with State
          Pension folded in. Numbers stay in your browser.
        </p>
      </header>

      <div className="mt-10">
        <RetirementCalculator />
      </div>
    </div>
  );
}

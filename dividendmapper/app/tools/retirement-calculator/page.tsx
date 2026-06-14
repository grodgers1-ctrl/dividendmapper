import type { Metadata } from "next";
import Link from "next/link";
import { RetirementCalculator } from "./_components/retirement-calculator";

export const metadata: Metadata = {
  title: "Retirement income calculator for dividend investors | UK ISA, SIPP and US 401(k)",
  description:
    "Estimate your income at retirement with a free dividend retirement calculator. Model Bear, Base and Bull scenarios across ISA, SIPP, GIA, 401(k), IRA and taxable accounts.",
  alternates: { canonical: "/tools/retirement-calculator" },
  openGraph: {
    title: "Retirement income calculator for dividend investors | DividendMapper",
    description:
      "See how much income your portfolio could produce at retirement. Model Bear, Base and Bull scenarios across UK ISA / SIPP / GIA or US 401(k) / IRA / Brokerage. Free, no signup.",
    url: "/tools/retirement-calculator",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Retirement Income Calculator | DividendMapper",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
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
    "Free retirement income calculator for UK and US dividend investors. UK mode covers ISA, SIPP, GIA and State Pension; US mode covers 401(k), IRA, Brokerage and Social Security. Three-scenario projection (Bear / Base / Bull) with FIRE number, year-by-year chart, income breakdown, and probability-weighted summary.",
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
          See how much dividend income your portfolio could produce at
          retirement. Three projections (Bear, Base, Bull) plus a
          probability-weighted average, for UK ISA / SIPP / GIA and State
          Pension, or US 401(k) / IRA / Brokerage and Social Security. Numbers
          stay in your browser.
        </p>
      </header>

      <div className="mt-10">
        <RetirementCalculator />
      </div>

      <section className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Read next
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          If the calculator changed how you think about wrapper mix, these three
          guides are the best next reads before you make the income plan more
          concrete.
        </p>
        <div className="mt-5 space-y-3 text-sm leading-relaxed">
          <p>
            <Link
              href="/blog/uk-dividend-tax-guide"
              className="font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              UK Dividend Tax Guide 2026/27
            </Link>
            {" "}for the allowance, band, and wrapper rules that shape what you
            actually keep.
          </p>
          <p>
            <Link
              href="/blog/why-headline-yield-can-be-misleading"
              className="font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Why Headline Yield Can Be Misleading
            </Link>
            {" "}if you want the income target to be built on a payout that is more
            likely to hold up.
          </p>
          <p>
            <Link
              href="/blog/retirement-income-calculator-guide"
              className="font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Retirement Income Calculator Guide
            </Link>
            {" "}for what each scenario means, how the Bear / Base / Bull
            projections work, and how to apply them to your own portfolio.
          </p>
        </div>
      </section>
    </div>
  );
}
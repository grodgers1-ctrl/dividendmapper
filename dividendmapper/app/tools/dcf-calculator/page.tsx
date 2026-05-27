import type { Metadata } from "next";
import { DcfCalculator } from "./_components/dcf-calculator";

export const metadata: Metadata = {
  title: "Dividend DCF Calculator: Intrinsic value of dividend stocks",
  description:
    "Free Dividend Discount Model (DDM) calculator: Gordon Growth intrinsic value, three-scenario probability-weighted fair value, margin-of-safety badge, and a sensitivity table. UK and US stocks.",
  alternates: { canonical: "/tools/dcf-calculator" },
  openGraph: {
    title: "Dividend DCF Calculator | DividendMapper",
    description:
      "Value any dividend stock with the Gordon Growth Dividend Discount Model. Three scenarios, margin-of-safety badge, sensitivity table.",
    url: "/tools/dcf-calculator",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Dividend DCF Calculator | DividendMapper",
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
  name: "Dividend DCF Calculator",
  url: "https://dividendmapper.com/tools/dcf-calculator",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  description:
    "Free Dividend Discount Model calculator. Computes intrinsic value, margin of safety, and probability-weighted fair value across Bear / Base / Bull scenarios. Includes a sensitivity table over growth and discount rates. UK (LSE) and US (NYSE/NASDAQ) ticker lookup.",
};

export default function DcfCalculatorPage() {
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
          Dividend DCF calculator
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          What&rsquo;s this dividend stock actually worth?
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          A Dividend Discount Model that values a stock by the dividends it
          pays you. Three scenarios, a margin-of-safety badge, and a
          sensitivity table that shows how much the answer moves when your
          growth and discount-rate assumptions move.
        </p>
      </header>

      <div className="mt-10">
        <DcfCalculator />
      </div>
    </div>
  );
}

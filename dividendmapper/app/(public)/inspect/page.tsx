import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { getTrendingTickers } from "@/lib/inspect/trending-tickers";
import { InspectSearch } from "./_components/inspect-search";

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
  const trending = await getTrendingTickers(6).catch(() => [] as string[]);

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Inspect a stock.
        </h1>
        <p className="mt-3 max-w-prose text-base text-foreground">
          Up to ten years of valuation, safety, growth and profitability for any UK
          or US share. Percentile bands show where today sits in the company&rsquo;s
          own history, so a high P/E in a perennially expensive stock reads
          differently from one in a normally cheap one.
        </p>

        <div className="mt-6">
          <InspectSearch />
        </div>

        {trending.length > 0 && (
          <section className="mt-6" aria-label="Trending today">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trending today
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {trending.map((ticker) => (
                <li key={ticker}>
                  <Link
                    href={`/inspect/${ticker}`}
                    className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-foreground hover:bg-secondary"
                  >
                    {ticker}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 max-w-prose text-sm text-muted-foreground">
          Three free lookups a day before signup. A free account bumps that to ten;
          Pro removes the cap.
        </p>

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Inspect surfaces history; it does not predict the future. Nothing here is
          financial advice or an instruction to buy or sell. Always do your own
          research. See the{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

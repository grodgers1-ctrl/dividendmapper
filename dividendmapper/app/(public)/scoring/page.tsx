import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { listScoredTickers } from "@/lib/scoring/scored-tickers";
import { ScoringSearch } from "./_components/scoring-search";

// Scores refresh nightly; an hour-old static render is plenty fresh.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Dividend resilience scores",
  description:
    "Quality, Risk and Trim scores screen a dividend's resilience for UK and US shares. Informational only, not financial advice.",
  alternates: { canonical: "/scoring" },
  openGraph: {
    title: "Dividend resilience scores | DividendMapper",
    description:
      "Quality, Risk and Trim scores screen a dividend's resilience. Informational only, not financial advice.",
    url: `${SITE_URL}/scoring`,
  },
};

export default async function ScoringIndexPage() {
  const tickers = await listScoredTickers();

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dividend resilience scores
        </h1>
        <p className="mt-3 max-w-prose text-base text-foreground">
          Each scored share gets three numbers from 0 to 100: a Quality score that screens
          how resilient the dividend looks, a Risk score that flags signs of cut pressure,
          and a Trim score for how extended the valuation looks. They refresh once a day.
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          These scores are a resilience check, not a recommendation to buy or sell, and not
          financial advice. They summarise data to help you review a holding.{" "}
          <Link
            href="/scoring-methodology"
            className="underline underline-offset-2 hover:text-foreground"
          >
            See the methodology
          </Link>
          .
        </p>

        <div className="mt-8">
          <label htmlFor="scoring-search" className="block text-sm font-medium text-foreground">
            Look up a share
          </label>
          <div className="mt-2">
            <ScoringSearch />
          </div>
        </div>

        {tickers.length > 0 && (
          <section className="mt-10" aria-label="Scored shares">
            <h2 className="text-lg font-semibold text-foreground">Scored shares</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {tickers.map((ticker) => (
                <li key={ticker}>
                  <Link
                    href={`/scoring/${ticker}`}
                    className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground transition-colors hover:bg-secondary"
                  >
                    {ticker}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Coverage is expanding. A share you search may not be scored yet.
            </p>
          </section>
        )}

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Scores are informational and refresh once a day. They are not financial advice, not a
          prediction of future returns, and not instructions to buy or sell. Always do your own
          research. See the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

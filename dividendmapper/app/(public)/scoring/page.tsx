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
    "Search any UK or US share for Quality, Risk and Trim dividend-resilience scores. Two free scores per day before signup. Informational only, not financial advice.",
  alternates: { canonical: "/scoring" },
  openGraph: {
    title: "Dividend resilience scores | DividendMapper",
    description:
      "Search any UK or US share. Quality, Risk and Trim scores screen a dividend's resilience.",
    url: `${SITE_URL}/scoring`,
  },
};

const EXAMPLE_CHIPS = ["AAPL", "ULVR.L", "SCHD", "BATS.L"];

export default async function ScoringIndexPage() {
  const tickers = await listScoredTickers();

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Look up any UK or US share.
        </h1>
        <p className="mt-3 max-w-prose text-base text-foreground">
          Search by name or symbol. We pull fundamentals, cash flow and dividend
          history, then return Quality, Trim and Risk scores plus a quick check
          on yield, payout and coverage.
        </p>

        <div className="mt-6">
          <ScoringSearch />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Try:</span>
          {EXAMPLE_CHIPS.map((chip) => (
            <Link
              key={chip}
              href={`/scoring/${chip}`}
              className="rounded-md border border-border bg-card px-2 py-1 font-mono text-foreground hover:bg-secondary"
            >
              {chip}
            </Link>
          ))}
        </div>

        <p className="mt-6 max-w-prose text-sm text-muted-foreground">
          Two scores per day on the house. Sign up free for a fresh counter, or
          upgrade to Pro to score every holding in your portfolio
          automatically.{" "}
          <Link
            href="/scoring-methodology"
            className="underline underline-offset-2 hover:text-foreground"
          >
            See the methodology
          </Link>
          .
        </p>

        {tickers.length > 0 && (
          <section className="mt-10" aria-label="Scored shares">
            <h2 className="text-lg font-semibold text-foreground">All scored shares</h2>
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
              Coverage grows every time someone searches. Any share you look up
              gets scored and joins the list.
            </p>
          </section>
        )}

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Scores are informational and refresh once a day. They are not
          financial advice, not a prediction of future returns, and not
          instructions to buy or sell. Always do your own research. See the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

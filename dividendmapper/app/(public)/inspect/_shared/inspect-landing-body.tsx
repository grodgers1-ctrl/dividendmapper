import Link from "next/link";
import { getTrendingTickers } from "@/lib/inspect/trending-tickers";
import { InspectSearch } from "../_components/inspect-search";

// Shared Inspect landing body. Server component. Used by both the public
// /inspect surface and the in-app /app/inspect surface. The `tickerHrefPrefix`
// drives both trending chip hrefs and the search component's destination so
// each surface keeps users in its own URL space.

type Props = {
  tickerHrefPrefix: string;
  chrome: "public" | "app";
};

export async function InspectLandingBody({ tickerHrefPrefix, chrome }: Props) {
  const trending = await getTrendingTickers(6).catch(() => [] as string[]);

  const Inner = (
    <>
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
        <InspectSearch hrefPrefix={tickerHrefPrefix} />
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
                  href={`${tickerHrefPrefix}/${ticker}`}
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
    </>
  );

  // Public route group sits outside any auth shell, so it owns its full
  // page background + max-width container. /app/inspect renders inside
  // DrawerShell, which already provides the canvas + outer padding.
  if (chrome === "public") {
    return (
      <div className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
          {Inner}
        </div>
      </div>
    );
  }

  return <div className="mx-auto max-w-3xl">{Inner}</div>;
}

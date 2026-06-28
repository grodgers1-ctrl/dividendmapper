import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { loadScore, normalizeTicker, type ScoreType } from "@/lib/scoring/load-score";
import { publicSummary } from "@/lib/scoring/public-summary";
import { chipColor } from "@/lib/scoring/chip-display";
import { primaryGateReason } from "@/lib/scoring/gate-reasons";
import type { GateCode } from "@/lib/scoring/quality-gates";
import { ProScoreDetail } from "../_components/pro-score-detail";
import { ScoreThisTicker } from "../_components/score-this-ticker";
import { QuickCheckStrip } from "../_components/quick-check-strip";

// Scores refresh nightly; an hour-old static render is plenty fresh and keeps
// these public pages cheap to crawl.
export const revalidate = 3600;
export const dynamicParams = true;

// Memoise the load per request so generateMetadata and the page body share one
// query. The public client is cookieless, so the page stays statically rendered.
const getScore = cache((ticker: string) =>
  loadScore(createSupabasePublicClient(), ticker),
);

// Latest current_yield for the Quick check strip. equity_scores doesn't carry
// a yield column; equity_score_history is public-read and indexed on
// (ticker, observed_at desc) so this is a single cheap row lookup.
const getLatestYield = cache(async (ticker: string): Promise<number | null> => {
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("equity_score_history")
    .select("current_yield")
    .eq("ticker", ticker)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ current_yield: number | null }>();
  return data?.current_yield != null ? Number(data.current_yield) : null;
});

export async function generateStaticParams(): Promise<{ ticker: string }[]> {
  // Prebuild the scored tickers. dynamicParams=true means anything not listed
  // (or everything, if the DB is briefly unreachable at build) still renders on
  // demand, so a lookup failure must not fail the build.
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase.from("equity_scores").select("ticker");
    return (data ?? []).map((r) => ({ ticker: (r as { ticker: string }).ticker }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) return {};
  const score = await getScore(ticker).catch(() => null);
  if (!score) {
    // The not-found path renders an auto-firing compute UI rather than a
    // hard 404. Noindex prevents Google caching the "Scoring..." render.
    return {
      title: `Scoring ${ticker}`,
      robots: { index: false, follow: true },
    };
  }
  const { headline } = publicSummary(score);
  // Keep the description within the ~160-char sweet spot. The headline already
  // carries the resilience framing; append the disclaimer only when it fits.
  const withDisclaimer = `${headline} A resilience check for ${ticker}, not financial advice.`;
  const description = withDisclaimer.length <= 158 ? withDisclaimer : headline;
  return {
    title: `${ticker} dividend resilience scores`,
    description,
    alternates: { canonical: `/scoring/${ticker}` },
    openGraph: {
      title: `${ticker} dividend resilience scores`,
      description: headline,
      url: `${SITE_URL}/scoring/${ticker}`,
    },
  };
}

const SCORE_CARDS: { type: ScoreType; label: string; blurb: string }[] = [
  { type: "buy", label: "Quality", blurb: "Dividend resilience screen" },
  { type: "risk", label: "Risk", blurb: "Signals of dividend-cut pressure" },
  { type: "trim", label: "Trim", blurb: "How extended the valuation looks" },
];

export default async function ScoringTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();
  const [score, latestYield] = await Promise.all([
    getScore(ticker).catch(() => null),
    getLatestYield(ticker).catch(() => null),
  ]);
  if (!score) {
    return (
      <div className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link
              href="/scoring"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <span aria-hidden>←</span>
              All dividend scores
            </Link>
          </nav>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
            {ticker}
          </h1>
          <div className="mt-8">
            <ScoreThisTicker ticker={ticker} />
          </div>
          <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
            Scores are informational. They are not financial advice, not a
            prediction of future returns, and not instructions to buy or sell.
          </p>
        </div>
      </div>
    );
  }

  const { headline } = publicSummary(score);
  const gateReason = primaryGateReason((score.buyFailedGates ?? []) as GateCode[]);

  const scoreValue = (type: ScoreType): number | null =>
    type === "buy" ? score.buyScore : type === "risk" ? score.riskScore : score.trimScore;

  // Neutral, content-describing schema. No Rating/Review/AggregateRating, which
  // would imply a buy/sell verdict that the reframe forbids. The breadcrumb
  // mirrors the visible nav.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${ticker} dividend resilience scores`,
      description: headline,
      url: `${SITE_URL}/scoring/${ticker}`,
      isPartOf: { "@type": "WebSite", name: "DividendMapper", url: SITE_URL },
      about: `Informational dividend-resilience scores (Quality, Risk, Trim) for ${ticker}. Not financial advice.`,
      license: `${SITE_URL}/terms`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Resilience", item: `${SITE_URL}/scoring` },
        { "@type": "ListItem", position: 2, name: ticker, item: `${SITE_URL}/scoring/${ticker}` },
      ],
    },
  ];

  return (
    <div className="bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link
            href="/scoring"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden>←</span>
            All dividend scores
          </Link>
        </nav>
        <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
          {ticker}
        </h1>
        <p className="mt-2 max-w-prose text-base text-foreground">{headline}</p>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          These are a resilience check on the dividend, not a recommendation to buy or sell.
          They are not financial advice.
        </p>

        <QuickCheckStrip
          signals={{
            forwardYield: latestYield,
            payoutRatio: score.payoutRatio,
            fcfCoverage: score.fcfCoverage,
            dividendCagr5y: score.dividendCagr5y,
          }}
        />

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {SCORE_CARDS.map(({ type, label, blurb }) => {
            const value = scoreValue(type);
            const isGateFail = type === "buy" && value === null;
            const accent = value === null ? "#94a3b8" : chipColor(type, value).hex;
            return (
              <div key={type} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground">{label}</p>
                {isGateFail ? (
                  <p className="mt-2 text-base font-semibold text-muted-foreground">
                    Did Not Qualify
                  </p>
                ) : value === null ? (
                  <p className="mt-2 text-base font-semibold text-muted-foreground">
                    Not available
                  </p>
                ) : (
                  <p
                    className="mt-2 font-mono text-4xl font-bold tabular-nums"
                    style={{ color: accent }}
                  >
                    {value}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {isGateFail && gateReason ? gateReason : blurb}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Link
            href={`/inspect/${ticker}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Inspect 10-year valuation history
            <span aria-hidden>→</span>
          </Link>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href="/scoring-methodology"
            className="underline underline-offset-2 hover:text-foreground"
          >
            How these scores are calculated (methodology)
          </Link>
        </p>

        <ProScoreDetail ticker={ticker} />

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

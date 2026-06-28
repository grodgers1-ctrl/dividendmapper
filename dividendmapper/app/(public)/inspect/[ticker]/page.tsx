import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SITE_URL } from "@/lib/site";
import { normalizeTicker } from "@/lib/scoring/load-score";
import { readCachedBundle } from "@/lib/inspect/read-cached-bundle";
import { loadInspectBundle } from "@/lib/inspect/load-inspect-bundle";
import { attachPercentileBand } from "@/lib/inspect/percentile-bands";
import { synthesiseVerdicts } from "@/lib/inspect/synthesise-verdicts";
import type { InspectBundle } from "@/lib/inspect/types";
import { InspectSnapshotStrip } from "../_components/inspect-snapshot-strip";
import { InspectGraphCard, type Metric } from "../_components/inspect-graph-card";
import { InspectUpsellCard } from "../_components/inspect-upsell-card";

// Inspect bundles refresh nightly via the API route's fall-through to FMP.
// An hour of ISR keeps the page cheap to crawl, and the cached HTML serves
// anonymous traffic without paying the API's rate-limit cost.
export const revalidate = 3600;
export const dynamicParams = true;

type LoadResult =
  | { ok: true; bundle: InspectBundle; cacheHit: boolean }
  | { ok: false; reason: "uncoverable" };

// Memoise per request so generateMetadata and the page body share one lookup.
const loadOrFetch = cache(async (ticker: string): Promise<LoadResult> => {
  const cached = await readCachedBundle(ticker).catch(() => null);
  if (cached) return { ok: true, bundle: cached, cacheHit: true };

  const loaded = await loadInspectBundle(ticker);
  if (loaded.status === "uncoverable") return { ok: false, reason: "uncoverable" };
  return { ok: true, bundle: loaded.bundle, cacheHit: false };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) return {};
  const result = await loadOrFetch(ticker).catch(() => null);
  if (!result || !result.ok) {
    return {
      title: `Inspect ${ticker}`,
      robots: { index: false, follow: true },
    };
  }
  return {
    title: `${ticker} valuation, safety, growth and profitability history`,
    description: `Ten-year history of valuation, safety, growth and profitability for ${ticker}, with percentile bands. Informational, not financial advice.`,
    alternates: { canonical: `/inspect/${ticker}` },
    openGraph: {
      title: `${ticker} inspect`,
      description: `Ten-year valuation, safety, growth and profitability history for ${ticker}.`,
      url: `${SITE_URL}/inspect/${ticker}`,
    },
  };
}

const VALUE_METRICS: [Metric, Metric, Metric] = [
  { key: "pe", label: "P/E", goodDirection: "low" },
  { key: "p_fcf", label: "P/FCF", goodDirection: "low" },
  { key: "dividend_yield", label: "Dividend yield", goodDirection: "high" },
];

const SAFETY_METRICS: [Metric, Metric, Metric] = [
  { key: "fcf_payout", label: "FCF payout", goodDirection: "low" },
  { key: "net_debt_ebitda", label: "Net debt / EBITDA", goodDirection: "low" },
  { key: "interest_coverage", label: "Interest coverage", goodDirection: "high" },
];

const GROWTH_METRICS: [Metric, Metric, Metric] = [
  { key: "dgr_5y", label: "DGR 5y", goodDirection: "high" },
  { key: "fcf_growth_yoy", label: "FCF growth (YoY)", goodDirection: "high" },
  { key: "roic", label: "ROIC", goodDirection: "high" },
];

const PROFITABILITY_METRICS: [Metric, Metric, Metric] = [
  { key: "gross_margin", label: "Gross margin", goodDirection: "high" },
  { key: "operating_margin", label: "Operating margin", goodDirection: "high" },
  { key: "net_margin", label: "Net margin", goodDirection: "high" },
];

// Mirror the API route's percentile-bands shape: the most-recent point's
// percentile within its own history.
function bandFor(
  rows: Array<{ observed_at: string; [k: string]: unknown }>,
  key: string,
): number | null {
  if (!rows.length) return null;
  const points = rows.map((r) => ({
    at: r.observed_at,
    raw: (r[key] as number | null | undefined) ?? null,
  }));
  return attachPercentileBand(points)[0]?.percentile ?? null;
}

export default async function InspectTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();

  const result = await loadOrFetch(ticker).catch((): LoadResult | null => null);

  if (!result || !result.ok) {
    return (
      <div className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link
              href="/inspect"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <span aria-hidden>&larr;</span>
              All Inspect lookups
            </Link>
          </nav>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
            {ticker}
          </h1>
          <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              We couldn&rsquo;t pull data for {ticker}.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The upstream data feed doesn&rsquo;t cover this symbol yet. Try a
              different ticker.
            </p>
            <Link
              href="/inspect"
              className="mt-5 inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary"
            >
              Try another share
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { bundle } = result;
  const q0 = bundle.quarterly[0] ?? {};
  const m0 = bundle.monthly[0] ?? {};

  const current = {
    pe: q0.pe ?? null,
    p_fcf: q0.p_fcf ?? null,
    dividend_yield: m0.dividend_yield ?? null,
    fcf_payout: q0.fcf_payout ?? null,
    net_debt_ebitda: q0.net_debt_ebitda ?? null,
    interest_coverage: q0.interest_coverage ?? null,
    dgr_5y: m0.dgr_5y ?? null,
    fcf_growth_yoy: q0.fcf_growth_yoy ?? null,
    roic: q0.roic ?? null,
    gross_margin: q0.gross_margin ?? null,
    operating_margin: q0.operating_margin ?? null,
    net_margin: q0.net_margin ?? null,
  };

  const percentiles = {
    pe: bandFor(bundle.quarterly, "pe"),
    p_fcf: bandFor(bundle.quarterly, "p_fcf"),
    dividend_yield: bandFor(bundle.monthly, "dividend_yield"),
    fcf_payout: bandFor(bundle.quarterly, "fcf_payout"),
    net_debt_ebitda: bandFor(bundle.quarterly, "net_debt_ebitda"),
    interest_coverage: bandFor(bundle.quarterly, "interest_coverage"),
    dgr_5y: bandFor(bundle.monthly, "dgr_5y"),
    fcf_growth_yoy: bandFor(bundle.quarterly, "fcf_growth_yoy"),
    roic: bandFor(bundle.quarterly, "roic"),
    gross_margin: bandFor(bundle.quarterly, "gross_margin"),
    operating_margin: bandFor(bundle.quarterly, "operating_margin"),
    net_margin: bandFor(bundle.quarterly, "net_margin"),
  };

  const verdicts = synthesiseVerdicts({ ticker, current, percentiles });

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link
            href="/inspect"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden>&larr;</span>
            All Inspect lookups
          </Link>
        </nav>
        <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
          {ticker}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Ten-year history of valuation, safety, growth and profitability, with
          percentile bands against {ticker}&rsquo;s own range.
        </p>

        {/* Window selector (3y / 5y / 10y) wires up Day 6 when the cards
            actually re-render off the selected window. */}

        <InspectSnapshotStrip current={current} percentiles={percentiles} />

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <InspectGraphCard
            title="Value"
            subtitle="Is the share cheap or dear by its own history?"
            verdict={verdicts.value}
            metrics={VALUE_METRICS}
            windowYears={10}
          />
          <InspectGraphCard
            title="Safety"
            subtitle="Can the business comfortably cover the dividend?"
            verdict={verdicts.safety}
            metrics={SAFETY_METRICS}
            windowYears={10}
          />
          <InspectGraphCard
            title="Growth"
            subtitle="Is the dividend and the cash behind it still growing?"
            verdict={verdicts.growth}
            metrics={GROWTH_METRICS}
            windowYears={10}
          />
          <InspectGraphCard
            title="Profitability"
            subtitle="How much of every pound of sales survives to the bottom line?"
            verdict={verdicts.profitability}
            metrics={PROFITABILITY_METRICS}
            windowYears={10}
          />
        </div>

        {/*
          Upsell card is hard-coded to "anon" while the page is statically
          rendered: reading auth would force it dynamic. Day 6 / Day 8 swap
          this for a small client island that reads the real tier.
        */}
        <InspectUpsellCard tier="anon" />

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Inspect surfaces history; it does not predict the future. Nothing here
          is financial advice or an instruction to buy or sell. Always do your
          own research. See the{" "}
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

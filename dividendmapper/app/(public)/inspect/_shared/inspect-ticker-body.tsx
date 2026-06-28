import Link from "next/link";
import { attachPercentileBand } from "@/lib/inspect/percentile-bands";
import { synthesiseVerdicts } from "@/lib/inspect/synthesise-verdicts";
import type {
  InspectBundle,
  InspectMetricFormat,
  InspectMetricSeries,
} from "@/lib/inspect/types";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";
import { InspectSnapshotStrip } from "../_components/inspect-snapshot-strip";
import { InspectUpsellCard } from "../_components/inspect-upsell-card";
import {
  InspectClientShell,
  type InspectCard,
} from "../[ticker]/_inspect-client-shell";
import type { LoadResult } from "./load-inspect-page-data";

// Shared Inspect ticker body. Server component. Used by both the public
// /inspect/[ticker] surface and the in-app /app/inspect/[ticker] surface.
// Parent route hands in the already-loaded bundle + profile so the wrapping
// container (public bleed-to-background vs. /app shell canvas) can vary
// without re-fetching.

type MetricConfig = {
  key: string;
  label: string;
  color: string;
  goodDirection: "high" | "low";
  format: InspectMetricFormat;
  source: "monthly" | "quarterly";
};

type CardConfig = {
  title: string;
  subtitle: string;
  verdictKey: "value" | "safety" | "growth" | "profitability";
  metrics: [MetricConfig, MetricConfig, MetricConfig];
};

const CARDS: [CardConfig, CardConfig, CardConfig, CardConfig] = [
  {
    title: "Value",
    subtitle: "Is the share cheap or dear by its own history?",
    verdictKey: "value",
    metrics: [
      { key: "pe", label: "P/E", color: "#3b82f6", goodDirection: "low", format: "multiple", source: "quarterly" },
      { key: "p_fcf", label: "P/FCF", color: "#f59e0b", goodDirection: "low", format: "multiple", source: "quarterly" },
      { key: "dividend_yield", label: "Yield", color: "#10b981", goodDirection: "high", format: "pct1", source: "monthly" },
    ],
  },
  {
    title: "Safety",
    subtitle: "Can the business comfortably cover the dividend?",
    verdictKey: "safety",
    metrics: [
      { key: "fcf_payout", label: "FCF Payout", color: "#3b82f6", goodDirection: "low", format: "pct", source: "quarterly" },
      { key: "net_debt_ebitda", label: "Net Debt/EBITDA", color: "#f59e0b", goodDirection: "low", format: "ratio", source: "quarterly" },
      { key: "interest_coverage", label: "Interest Coverage", color: "#10b981", goodDirection: "high", format: "ratio", source: "quarterly" },
    ],
  },
  {
    title: "Growth",
    subtitle: "Is the dividend and the cash behind it still growing?",
    verdictKey: "growth",
    metrics: [
      { key: "dgr_5y", label: "DGR 5y", color: "#3b82f6", goodDirection: "high", format: "pct", source: "monthly" },
      { key: "fcf_growth_yoy", label: "FCF Growth", color: "#f59e0b", goodDirection: "high", format: "pct", source: "quarterly" },
      { key: "roic", label: "ROIC", color: "#10b981", goodDirection: "high", format: "pct", source: "quarterly" },
    ],
  },
  {
    title: "Profitability",
    subtitle: "Is the engine getting better or worse at making money?",
    verdictKey: "profitability",
    metrics: [
      { key: "gross_margin", label: "Gross Margin", color: "#3b82f6", goodDirection: "high", format: "pct", source: "quarterly" },
      { key: "operating_margin", label: "Operating Margin", color: "#f59e0b", goodDirection: "high", format: "pct", source: "quarterly" },
      { key: "net_margin", label: "Net Margin", color: "#10b981", goodDirection: "high", format: "pct", source: "quarterly" },
    ],
  },
];

function buildSeries(
  bundle: InspectBundle,
  cfg: MetricConfig,
): InspectMetricSeries {
  const rows = cfg.source === "monthly" ? bundle.monthly : bundle.quarterly;
  const banded = attachPercentileBand(
    rows.map((r) => ({
      at: r.observed_at,
      raw:
        ((r as unknown as Record<string, number | null | undefined>)[cfg.key] ??
          null) as number | null,
    })),
  );
  return {
    key: cfg.key,
    label: cfg.label,
    color: cfg.color,
    cadence: cfg.source,
    rangeYears:
      cfg.source === "monthly"
        ? bundle.rangeYearsMonthly
        : bundle.rangeYearsQuarterly,
    goodDirection: cfg.goodDirection,
    format: cfg.format,
    points: banded,
  };
}

// Mirror of the API route's percentile shape: most-recent point's percentile
// within its own history. Drives the snapshot strip + verdict copy.
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

type Tier = "anon" | "free" | "pro";

type Props = {
  ticker: string;
  result: LoadResult;
  profile: { name: string | null };
  tier: Tier;
  backHref: string;
  chrome: "public" | "app";
};

export function InspectTickerBody({
  ticker,
  result,
  profile,
  tier,
  backHref,
  chrome,
}: Props) {
  if (!result.ok) {
    const inner = (
      <>
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link
            href={backHref}
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
            href={backHref}
            className="mt-5 inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            Try another share
          </Link>
        </div>
      </>
    );

    if (chrome === "public") {
      return (
        <div className="bg-background">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
            {inner}
          </div>
        </div>
      );
    }
    return <div className="mx-auto max-w-3xl">{inner}</div>;
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

  const cards = CARDS.map((cfg): InspectCard => ({
    title: cfg.title,
    subtitle: cfg.subtitle,
    verdict: verdicts[cfg.verdictKey],
    metrics: [
      buildSeries(bundle, cfg.metrics[0]),
      buildSeries(bundle, cfg.metrics[1]),
      buildSeries(bundle, cfg.metrics[2]),
    ],
  })) as [InspectCard, InspectCard, InspectCard, InspectCard];

  const available10y = bundle.rangeYearsMonthly >= 9.5;

  const inner = (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <span aria-hidden>&larr;</span>
          All Inspect lookups
        </Link>
      </nav>
      <div className="mt-2 flex items-center gap-4">
        <HoldingLogo ticker={ticker} name={profile.name ?? undefined} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground">
            {ticker}
          </h1>
          {profile.name && (
            <p className="truncate text-base text-muted-foreground">
              {profile.name}
            </p>
          )}
        </div>
      </div>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Ten-year history of valuation, safety, growth and profitability, with
        percentile bands against {ticker}&rsquo;s own range.
      </p>

      <InspectSnapshotStrip current={current} percentiles={percentiles} />

      <InspectClientShell cards={cards} available10y={available10y} />

      <InspectUpsellCard tier={tier} />

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
    </>
  );

  if (chrome === "public") {
    return (
      <div className="bg-background">
        <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-12">
          {inner}
        </div>
      </div>
    );
  }

  return <div className="mx-auto max-w-4xl">{inner}</div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPricingPublic } from "@/lib/flags/pricing";
import { aggregatePortfolioIncome } from "@/lib/portfolio/income";
import { fetchPortfolioQuotes } from "@/lib/portfolio/quotes";
import { isUkTicker, mergeUkDividends } from "@/lib/portfolio/uk-income";
import {
  buildHoldingScore,
  applyUserWeights,
  flaggedHoldings,
  type HoldingScore,
  type ScoreRow,
  type PriorHistory,
  type OverrideRow,
} from "@/lib/scoring/portfolio-scores";
import { isBeta } from "@/lib/scoring/config";
import { HoldingsTable } from "./_components/holdings-table";
import { AddHoldingLauncher } from "./_components/add-holding-launcher";
import { PortfolioIncomeChart } from "./_components/portfolio-income-chart";
import { PortfolioSummaryBanner } from "./_components/portfolio-summary-banner";
import { ConcentrationWarning } from "./_components/concentration-warning";
import { computeConcentration } from "@/lib/portfolio/concentration";
import { FREE_TIER_LIMIT } from "./_components/free-tier-copy";

// 30 trading days ≈ 42 calendar days; the history row at/just before that point
// is the delta baseline. Until ~6 weeks of history accrues this finds nothing
// and deltas stay null (chips simply omit the delta pill).
const DELTA_LOOKBACK_DAYS = 42;

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

// app/app/layout.tsx already gates via requireUser(). Force dynamic so the
// server-side holdings query runs on every request. The page is per-user
// and never cacheable.
export const dynamic = "force-dynamic";

type HoldingRow = {
  id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  wrapper: string;
  broker_label: string | null;
  notes: string | null;
  created_at: string;
};

export default async function PortfolioPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createSupabaseServerClient();
  const pricingPublic = isPricingPublic();

  // Single holdings query covers both the table render and the income roll-up.
  // We query the unbounded set and slice in memory for the free-tier cap, so
  // the income chart can count holdings hidden from the table without a
  // second round-trip. The income aggregator is a pure function over
  // (holdings, quotes).
  const [profileResult, holdingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .maybeSingle<{ tier: "free" | "pro" | "premium" }>(),
    supabase
      .from("holdings")
      .select(
        "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<HoldingRow[]>(),
  ]);

  const tier = profileResult.data?.tier ?? "free";
  const allHoldings = holdingsResult.data ?? [];
  const holdingsError = holdingsResult.error;
  const total = allHoldings.length;
  const visibleRows =
    tier === "free" ? allHoldings.slice(0, FREE_TIER_LIMIT) : allHoldings;
  const atFreeLimit = tier === "free" && total >= FREE_TIER_LIMIT;
  const hiddenCount = tier === "free" ? Math.max(0, total - FREE_TIER_LIMIT) : 0;

  const rawQuotes = await fetchPortfolioQuotes(allHoldings);

  // UK (.L) holdings lost their income when EODHD was cancelled (FMP took over
  // scoring 2026-05-29). FMP already pulls LSE dividends nightly into
  // equity_score_history, so patch those tickers from there (pence -> £).
  const ukTickers = [...new Set(allHoldings.map((h) => h.ticker))].filter(
    isUkTicker,
  );
  const ukDividendByTicker = new Map<string, number>();
  if (ukTickers.length > 0) {
    const { data: ukDivRows } = await supabase
      .from("equity_score_history")
      .select("ticker, dividend_per_share, observed_at")
      .in("ticker", ukTickers)
      .order("observed_at", { ascending: false })
      .returns<
        { ticker: string; dividend_per_share: number | null; observed_at: string }[]
      >();
    for (const r of ukDivRows ?? []) {
      // rows are newest-first; keep the first (latest) per ticker.
      if (!ukDividendByTicker.has(r.ticker) && r.dividend_per_share != null) {
        ukDividendByTicker.set(r.ticker, Number(r.dividend_per_share));
      }
    }
  }
  const quotes = mergeUkDividends(rawQuotes, ukTickers, ukDividendByTicker);

  const income = aggregatePortfolioIncome(allHoldings, quotes);
  const concentration = computeConcentration(allHoldings, quotes);
  // Map doesn't reliably survive Next's router cache when crossing the
  // server/client boundary; the table receives an empty Map on return
  // navigation. Plain object survives.
  const quotesByTicker = Object.fromEntries(quotes);

  // Scores are a Pro+ feature; Free sees the upgrade pill instead, so skip the
  // queries entirely for Free. Per-ticker scoring joins cleanly on ticker
  // (the cron derives its universe from holdings, so tickers already match).
  const scoresByTicker: Record<string, HoldingScore> = {};
  let flagged: { ticker: string; hint: string }[] = [];
  if (tier !== "free" && visibleRows.length > 0) {
    const tickers = [...new Set(visibleRows.map((h) => h.ticker))];
    const now = new Date();
    const cutoff = new Date(now.getTime() - DELTA_LOOKBACK_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const [scoresRes, overridesRes, historyRes] = await Promise.all([
      supabase
        .from("equity_scores")
        .select(
          "ticker, buy_score, trim_score, risk_score, buy_failed_gates, data_quality",
        )
        .in("ticker", tickers)
        .returns<ScoreRow[]>(),
      supabase
        .from("score_overrides")
        .select("ticker, score_type, expires_at")
        .eq("user_id", user.id)
        .returns<(OverrideRow & { ticker: string })[]>(),
      supabase
        .from("equity_score_history")
        .select("ticker, buy_score, trim_score, risk_score, observed_at")
        .in("ticker", tickers)
        .lte("observed_at", cutoff)
        .order("observed_at", { ascending: false })
        .returns<(PriorHistory & { ticker: string; observed_at: string })[]>(),
    ]);

    const overridesByTicker = new Map<string, OverrideRow[]>();
    for (const o of overridesRes.data ?? []) {
      const list = overridesByTicker.get(o.ticker) ?? [];
      list.push({ score_type: o.score_type, expires_at: o.expires_at });
      overridesByTicker.set(o.ticker, list);
    }
    // history is sorted newest-first; first row per ticker is the baseline.
    const priorByTicker = new Map<string, PriorHistory>();
    for (const h of historyRes.data ?? []) {
      if (!priorByTicker.has(h.ticker)) {
        priorByTicker.set(h.ticker, {
          buy_score: h.buy_score,
          trim_score: h.trim_score,
          risk_score: h.risk_score,
        });
      }
    }

    for (const score of scoresRes.data ?? []) {
      scoresByTicker[score.ticker] = applyUserWeights(
        buildHoldingScore({
          score,
          priorHistory: priorByTicker.get(score.ticker) ?? null,
          overrides: overridesByTicker.get(score.ticker) ?? [],
          now,
        }),
        null,
      );
    }
    // Flag from the distinct holdings actually shown.
    flagged = flaggedHoldings(
      tickers.map((t) => scoresByTicker[t]).filter(Boolean),
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your portfolio
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {total === 0
              ? "Add your holdings one at a time. Broker sync ships in Phase 3."
              : `${total} holding${total === 1 ? "" : "s"} · ${
                  tier === "free"
                    ? `${Math.min(total, FREE_TIER_LIMIT)}/${FREE_TIER_LIMIT} on Free`
                    : "Pro · unlimited"
                }`}
          </p>
        </div>
        <AddHoldingLauncher
          atFreeLimit={atFreeLimit}
          pricingPublic={pricingPublic}
        />
      </div>

      <div className="mt-8">
        {holdingsError ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              We couldn&apos;t load your holdings
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Refresh the page to try again. If this keeps happening, sign out
              and back in.
            </p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              No holdings yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Add your first holding to see it here. Ticker, quantity, cost
              basis, and the wrapper it sits in. Everything else comes from
              market data.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {hiddenCount > 0 && (
              <div
                role="status"
                className="rounded-lg border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
              >
                <p className="font-display text-sm font-semibold">
                  {hiddenCount} holding{hiddenCount === 1 ? "" : "s"} hidden
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Free shows your {FREE_TIER_LIMIT} most recent holdings in the
                  table. Your income below counts all {total}. Upgrade to Pro
                  to see them all.
                </p>
                {pricingPublic && (
                  <Link
                    href="/pricing"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Upgrade to Pro
                    <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            )}
            <PortfolioSummaryBanner flagged={flagged} />
            <ConcentrationWarning
              overweight={concentration.overweight}
              threshold={concentration.threshold}
            />
            <HoldingsTable
              rows={visibleRows}
              quotes={quotesByTicker}
              tier={tier}
              pricingPublic={pricingPublic}
              isBeta={isBeta()}
              scoresByTicker={scoresByTicker}
            />
            <PortfolioIncomeChart income={income} />
          </div>
        )}
      </div>
    </div>
  );
}

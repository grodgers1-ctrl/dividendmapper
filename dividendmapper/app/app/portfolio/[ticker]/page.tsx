import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { actualKey } from "@/lib/portfolio/income";
import { resolveRowValue } from "@/lib/portfolio/row-value";
import { loadScore, normalizeTicker } from "@/lib/scoring/load-score";
import { isBeta } from "@/lib/scoring/config";
import { holdingNeighbours } from "@/lib/portfolio/holding-neighbours";
import { HoldingHeader } from "./_components/HoldingHeader";
import { PositionCard } from "./_components/PositionCard";
import { IncomeCard } from "./_components/IncomeCard";
import { ResilienceCard } from "./_components/ResilienceCard";
import { HoldingPagerNav } from "./_components/HoldingPagerNav";
import { UpgradeCard } from "@/app/app/dashboard/_components/UpgradeCard";

export const metadata: Metadata = {
  title: "Holding detail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Day 7 holding detail page. Server component — per
// [[reference_app_page_auth_guard]] every protected page calls requireUser()
// itself. 404 logic: if the URL ticker doesn't match a row in the user's
// holdings (RLS keeps cross-user reads impossible), notFound() is raised.

export default async function HoldingDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) notFound();

  const user = await requireUser(`/app/portfolio/${ticker}`);

  // Reuse the existing loader rather than duplicate the holding/quote/income
  // plumbing. It's already optimised (single round-trip for holdings + scoring
  // dividends + names) and the data shapes match what the cards expect.
  const priced = await loadPricedHoldings(user.id);

  // Find the user's row(s) for this ticker. A user can hold the same ticker
  // in multiple wrappers (ISA + GIA, say); for the v1 detail page we render
  // the first row — Phase 4 may surface per-wrapper rows.
  const holding = priced.allHoldings.find((h) => h.ticker === ticker);
  if (!holding) notFound();

  const isPro = priced.tier !== "free";
  const beta = isBeta();

  // Score is Pro-only: cheaper not to round-trip the equity_scores +
  // equity_score_signals query for Free users.
  const supabase = await createSupabaseServerClient();
  const score = isPro ? await loadScore(supabase, ticker) : null;

  // Per-holding value: quantity × scoring price (en GBP for .L, USD for US).
  const valueStatus = resolveRowValue(
    { ticker: holding.ticker, quantity: holding.quantity },
    priced.priceByTicker,
  );
  const valueAmount = valueStatus.kind === "ok" ? valueStatus.amount : null;
  const valueCurrency = valueStatus.kind === "ok" ? valueStatus.currency : null;

  // Forward annual income: quantity × forward dps (FMP). Quote merges already
  // happened in loadPricedHoldings, so we just read it back here.
  const quote = priced.quotes.get(holding.ticker);
  const forwardDps = quote?.ok ? quote.data.dividend : null;
  const forwardCurrency = quote?.ok ? quote.data.currency : null;
  const forwardAnnual =
    forwardDps !== null && forwardDps !== undefined && forwardDps > 0
      ? Number(holding.quantity) * forwardDps
      : null;

  // TTM real broker-synced income for this (ticker × wrapper).
  const actual = priced.actualsByKey[actualKey(ticker, holding.wrapper)] ?? null;

  // Yield on cost: forward annual ÷ (quantity × avg_cost) × 100. Only when
  // both numbers share a currency (cost row's currency vs the forward income
  // currency); otherwise the ratio is meaningless without FX.
  const yieldOnCostPct =
    forwardAnnual !== null &&
    forwardCurrency === holding.cost_currency &&
    holding.avg_cost > 0
      ? (forwardAnnual / (Number(holding.quantity) * holding.avg_cost)) * 100
      : null;

  // Next ex-div + payout calendar: equity_scores carries the FMP-sourced
  // calendar columns. Query directly here — loadPortfolioAnalytics already
  // does this for the full portfolio, but pulling one row is trivial.
  const { data: exDivRow } = await supabase
    .from("equity_scores")
    .select("next_ex_div_date, next_ex_div_amount, next_ex_div_pay_date")
    .eq("ticker", ticker)
    .maybeSingle<{
      next_ex_div_date: string | null;
      next_ex_div_amount: number | null;
      next_ex_div_pay_date: string | null;
    }>();

  // Picker + pager use the distinct alpha-sorted ticker set.
  const allTickers = [...new Set(priced.allHoldings.map((h) => h.ticker))];
  const neighbours = holdingNeighbours(allTickers, ticker);
  const pickerItems = allTickers
    .sort()
    .map((t) => ({
      ticker: t,
      name: priced.nameByTicker[t] ?? null,
    }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <HoldingHeader
        ticker={ticker}
        name={priced.nameByTicker[ticker] ?? null}
        wrapper={holding.wrapper}
        source={holding.source}
        pickerItems={pickerItems}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <PositionCard
            quantity={Number(holding.quantity)}
            avgCost={holding.avg_cost}
            costCurrency={holding.cost_currency}
            valueAmount={valueAmount}
            valueCurrency={valueCurrency}
            wrapper={holding.wrapper}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <IncomeCard
            forwardAnnual={forwardAnnual}
            forwardCurrency={forwardCurrency ?? null}
            receivedTtm={actual?.amount ?? null}
            receivedCurrency={actual?.currency ?? null}
            yieldOnCostPct={yieldOnCostPct}
            avgCost={holding.avg_cost}
            quantity={Number(holding.quantity)}
            costCurrency={holding.cost_currency}
            wrapper={holding.wrapper}
            nextExDivDate={exDivRow?.next_ex_div_date ?? null}
            nextExDivAmount={exDivRow?.next_ex_div_amount ?? null}
            frequency={null}
          />
        </div>
        <div className="col-span-12">
          {isPro ? (
            <ResilienceCard
              ticker={ticker}
              quality={score?.buyScore ?? null}
              trim={score?.trimScore ?? null}
              risk={score?.riskScore ?? null}
              qualityGateReason={null}
              isBeta={beta}
            />
          ) : (
            <UpgradeCard />
          )}
        </div>
      </div>

      {neighbours && (
        <HoldingPagerNav
          prev={neighbours.prev}
          next={neighbours.next}
          position={neighbours.position}
          total={neighbours.total}
        />
      )}
    </div>
  );
}

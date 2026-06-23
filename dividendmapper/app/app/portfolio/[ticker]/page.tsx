import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { actualKey } from "@/lib/portfolio/income";
import { deriveFrequency } from "@/lib/portfolio/derive-frequency";
import { resolveRowValue } from "@/lib/portfolio/row-value";
import { ratesToGbpFor } from "@/lib/scoring/currency";
import { loadScore, normalizeTicker } from "@/lib/scoring/load-score";
import { isBeta } from "@/lib/scoring/config";
import { holdingNeighbours } from "@/lib/portfolio/holding-neighbours";
import { HoldingHeader } from "./_components/HoldingHeader";
import { PositionCard } from "./_components/PositionCard";
import { IncomeCard } from "./_components/IncomeCard";
import { ResilienceCard } from "./_components/ResilienceCard";
import { HoldingPagerNav } from "./_components/HoldingPagerNav";
import { ScoreHistoryChart } from "./_components/ScoreHistoryChart";
import { FundamentalsCard } from "./_components/FundamentalsCard";
import { SignalContributionsList } from "./_components/SignalContributionsList";
import { DividendHistoryCard } from "./_components/DividendHistoryCard";
import { UpgradeCard } from "@/app/app/dashboard/_components/UpgradeCard";

export const metadata: Metadata = {
  title: "Holding detail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Day 7 + 8 holding detail page. Server component. requireUser() guards;
// notFound() if the URL ticker isn't in the user's owned set.

const SCORE_HISTORY_DAYS = 30;

export default async function HoldingDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) notFound();

  const user = await requireUser(`/app/portfolio/${ticker}`);

  const priced = await loadPricedHoldings(user.id);

  const holding = priced.allHoldings.find((h) => h.ticker === ticker);
  if (!holding) notFound();

  const isPro = priced.tier !== "free";
  const beta = isBeta();

  const supabase = await createSupabaseServerClient();

  // Pro: score + history + dividend list in parallel. Free: skip score
  // (cheaper) but still show the user's own dividend history.
  //
  // react-hooks/purity flags Date.now() during render. Server components
  // legitimately re-execute per request — Date.now() is the right primitive
  // for a per-request "30 days ago" cutoff.
  // eslint-disable-next-line react-hooks/purity
  const sinceDate = new Date(Date.now() - SCORE_HISTORY_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [score, latestRow, history, userDividends, exDivRow] = await Promise.all([
    isPro ? loadScore(supabase, ticker) : Promise.resolve(null),
    supabase
      .from("equity_score_history")
      .select(
        "ticker, observed_at, buy_score, trim_score, risk_score, current_price, current_yield, dividend_per_share, eps_avg, net_debt_to_ebitda, interest_coverage",
      )
      .eq("ticker", ticker)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        ticker: string;
        observed_at: string;
        buy_score: number | null;
        trim_score: number | null;
        risk_score: number | null;
        current_price: number | null;
        current_yield: number | null;
        dividend_per_share: number | null;
        eps_avg: number | null;
        net_debt_to_ebitda: number | null;
        interest_coverage: number | null;
      }>(),
    isPro
      ? supabase
          .from("equity_score_history")
          .select("observed_at, buy_score, trim_score, risk_score")
          .eq("ticker", ticker)
          .gte("observed_at", sinceDate)
          .order("observed_at", { ascending: true })
          .returns<
            {
              observed_at: string;
              buy_score: number | null;
              trim_score: number | null;
              risk_score: number | null;
            }[]
          >()
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("user_dividends")
      .select("paid_on, amount, currency, ticker_scoring, wrapper")
      .eq("ticker_scoring", ticker)
      .eq("wrapper", holding.wrapper)
      .order("paid_on", { ascending: false })
      .limit(24)
      .returns<
        {
          paid_on: string;
          amount: number;
          currency: string;
          ticker_scoring: string;
          wrapper: string;
        }[]
      >(),
    supabase
      .from("equity_scores")
      .select("next_ex_div_date, next_ex_div_amount, next_ex_div_pay_date")
      .eq("ticker", ticker)
      .maybeSingle<{
        next_ex_div_date: string | null;
        next_ex_div_amount: number | null;
        next_ex_div_pay_date: string | null;
      }>(),
  ]);

  // Per-holding value: quantity × FMP price (display units already converted).
  const valueStatus = resolveRowValue(
    { ticker: holding.ticker, quantity: holding.quantity },
    priced.priceByTicker,
  );
  const valueAmount = valueStatus.kind === "ok" ? valueStatus.amount : null;
  const valueCurrency = valueStatus.kind === "ok" ? valueStatus.currency : null;

  // FX map for the cost + value currencies — feeds PositionCard's
  // cross-currency P/L. Two currencies max, both cached after first lookup.
  const positionCurrencies = new Set<string>();
  positionCurrencies.add(holding.cost_currency);
  if (valueCurrency) positionCurrencies.add(valueCurrency);
  const positionRatesToGbp = await ratesToGbpFor([...positionCurrencies]);

  const quote = priced.quotes.get(holding.ticker);
  const forwardDps = quote?.ok ? quote.data.dividend : null;
  const forwardCurrency = quote?.ok ? quote.data.currency : null;
  const forwardAnnual =
    forwardDps !== null && forwardDps !== undefined && forwardDps > 0
      ? Number(holding.quantity) * forwardDps
      : null;

  const actual = priced.actualsByKey[actualKey(ticker, holding.wrapper)] ?? null;

  const yieldOnCostPct =
    forwardAnnual !== null &&
    forwardCurrency === holding.cost_currency &&
    holding.avg_cost > 0
      ? (forwardAnnual / (Number(holding.quantity) * holding.avg_cost)) * 100
      : null;

  // Derive fundamentals from the latest equity_score_history row.
  // FMP-derived columns are nightly. Anything we don't have yet renders as a
  // — placeholder per FundamentalsCard. Trailing P/E now lives on
  // equity_scores (column trailing_pe) — the page no longer derives it from
  // price/eps_avg because eps_avg holds forward EPS (R4 input).
  const latest = latestRow.data;

  const scoreHistorySeries = (history.data ?? []).map((row) => ({
    date: row.observed_at,
    buy: row.buy_score,
    trim: row.trim_score,
    risk: row.risk_score,
  }));

  const dividendPayments = (userDividends.data ?? []).map((d) => ({
    date: d.paid_on,
    amount: Number(d.amount),
    currency: d.currency,
    kind: "actual" as const,
  }));

  // Derive payment cadence from the user's broker-synced dividend history.
  // equity_scores has no frequency column; this fills the gap for IncomeCard.
  // Server components legitimately re-execute per request — Date.now() is the
  // right primitive for "today" in this derivation.
  // eslint-disable-next-line react-hooks/purity
  const today = new Date(Date.now());
  const frequency = deriveFrequency(
    (userDividends.data ?? []).map((d) => d.paid_on),
    today,
  );

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
        edit={{
          holdingId: holding.id,
          quantity: Number(holding.quantity),
          avgCost: holding.avg_cost,
          costCurrency:
            holding.cost_currency === "USD" ? "USD" : "GBP",
          brokerLabel: holding.broker_label,
          notes: holding.notes,
        }}
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
            ratesToGbp={positionRatesToGbp}
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
            nextExDivDate={exDivRow.data?.next_ex_div_date ?? null}
            nextExDivAmount={exDivRow.data?.next_ex_div_amount ?? null}
            frequency={frequency}
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

        {/* Pro-only deeper widgets — Free users see only Position + Income +
            UpgradeCard above and Dividend history below. */}
        {isPro && (
          <>
            <div className="col-span-12">
              <ScoreHistoryChart series={scoreHistorySeries} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <FundamentalsCard
                pe={score?.trailingPe ?? null}
                forwardPe={score?.forwardPe ?? null}
                payoutRatio={score?.payoutRatio ?? null}
                netDebtToEbitda={
                  latest?.net_debt_to_ebitda != null
                    ? Number(latest.net_debt_to_ebitda)
                    : null
                }
                fcfCoverage={score?.fcfCoverage ?? null}
                currentYield={
                  latest?.current_yield != null
                    ? Number(latest.current_yield)
                    : null
                }
                dividendCagr5y={score?.dividendCagr5y ?? null}
                sector={score?.sector ?? null}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <SignalContributionsList
                signals={score?.signals.buy ?? []}
                title="Quality signals"
              />
            </div>
          </>
        )}

        <div className="col-span-12">
          <DividendHistoryCard payments={dividendPayments} />
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

// Server-side Reinvest Recommender assembler. The portfolio page already computes
// holdings, quotes (UK-merged), per-ticker concentration weights, scores, and FX
// rates; this turns them into a card when a holding goes ex-dividend within the
// window. Pure: no I/O. Framing is diversification / income-hygiene, never alpha.

import type { QuoteResult } from "@/lib/market/quote";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import { isUkTicker } from "@/lib/portfolio/uk-income";
import { buildSuggestions, type Holding, type Suggestion } from "./build-suggestions";

export interface CardHolding {
  id: string;
  ticker: string;
  quantity: number;
  sector?: string | null;
}

export interface ExDiv {
  date: string; // YYYY-MM-DD ex-dividend date
  amount: number | null; // per share, native units (USD, or GBX pence for .L)
  payDate: string | null;
}

export interface ReinvestCardInput {
  holdings: CardHolding[];
  exDivByTicker: Record<string, ExDiv>;
  quotesByTicker: Record<string, QuoteResult>;
  ratesToGbp: Record<string, number>; // e.g. { GBP: 1, USD: 0.79 }
  scoresByTicker: Record<string, HoldingScore>;
  weightByTicker: Record<string, number>; // from computeConcentration.positions
  totalPortfolioIncomeGbp: number;
  sectorsToAvoid?: string[];
  today: string; // YYYY-MM-DD (injected; never Date.now() here)
  windowDays?: number; // default 5
}

export interface ReinvestCard {
  trigger: {
    holdingId: string;
    ticker: string;
    exDivDate: string;
    payDate: string | null;
    estPaymentGbp: number | null;
    currentWeight: number | null; // trigger's own portfolio weight, for the copy
  };
  candidates: Suggestion[]; // up to 10; card shows 5 + "Show more"
}

const DAY_MS = 86_400_000;

function dayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

// Convert a per-share amount in native units to GBP. `.L` amounts are pence
// (divide by 100, regardless of the synthesised "GBP" quote currency); others
// use the quote currency's FX rate. Returns null when it can't be converted.
function nativeAmountToGbp(
  ticker: string,
  amount: number | null,
  quote: QuoteResult | undefined,
  rates: Record<string, number>,
): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  if (isUkTicker(ticker)) return amount / 100;
  const currency = quote?.ok ? quote.data.currency : null;
  const rate = currency != null ? rates[currency] : undefined;
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return null;
  return amount * rate;
}

// A holding's annual dividend in GBP (same approximation the income view uses:
// quote.dividend is the per-share annual figure). `.L` dividends are already £.
function holdingAnnualDivGbp(
  ticker: string,
  qty: number,
  quote: QuoteResult | undefined,
  rates: Record<string, number>,
): number {
  if (!quote?.ok) return 0;
  const div = quote.data.dividend;
  if (div === null || div === undefined || div <= 0) return 0;
  if (isUkTicker(ticker)) return qty * div;
  const rate = quote.data.currency != null ? rates[quote.data.currency] : undefined;
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return 0;
  return qty * div * rate;
}

interface AggTicker {
  ticker: string;
  firstId: string;
  totalQty: number;
  sector: string | null;
}

export function buildReinvestCard(input: ReinvestCardInput): ReinvestCard | null {
  const windowDays = input.windowDays ?? 5;
  const todayMs = dayMs(input.today);
  const boundaryMs = todayMs + windowDays * DAY_MS;

  // Aggregate holdings by ticker (a ticker may be held across multiple wrappers).
  const byTicker = new Map<string, AggTicker>();
  for (const h of input.holdings) {
    const qty = Number(h.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const existing = byTicker.get(h.ticker);
    if (existing) {
      existing.totalQty += qty;
    } else {
      byTicker.set(h.ticker, {
        ticker: h.ticker,
        firstId: h.id,
        totalQty: qty,
        sector: h.sector ?? null,
      });
    }
  }

  // Find every ticker with an ex-div in [today, today + windowDays].
  type TriggerCandidate = AggTicker & {
    exDivDate: string;
    payDate: string | null;
    estPaymentGbp: number | null;
  };
  const triggers: TriggerCandidate[] = [];
  for (const agg of byTicker.values()) {
    const ex = input.exDivByTicker[agg.ticker];
    if (!ex || !ex.date) continue;
    const exMs = dayMs(ex.date);
    if (!Number.isFinite(exMs) || exMs < todayMs || exMs > boundaryMs) continue;
    const perShareGbp = nativeAmountToGbp(
      agg.ticker,
      ex.amount,
      input.quotesByTicker[agg.ticker],
      input.ratesToGbp,
    );
    triggers.push({
      ...agg,
      exDivDate: ex.date,
      payDate: ex.payDate,
      estPaymentGbp: perShareGbp === null ? null : perShareGbp * agg.totalQty,
    });
  }
  if (triggers.length === 0) return null;

  // Soonest ex-div wins; tie broken by the larger estimated payment (nulls last).
  triggers.sort((a, b) => {
    if (a.exDivDate !== b.exDivDate) return a.exDivDate < b.exDivDate ? -1 : 1;
    return (b.estPaymentGbp ?? -1) - (a.estPaymentGbp ?? -1);
  });
  const trigger = triggers[0];

  // Candidates: every OTHER ticker, mapped to the reinvest Holding shape.
  // buildSuggestions excludes null-buy / hidden / sector-avoided itself.
  const candidateHoldings: Holding[] = [];
  const weightByHoldingId: Record<string, number> = {};
  for (const agg of byTicker.values()) {
    if (agg.ticker === trigger.ticker) continue;
    const score = input.scoresByTicker[agg.ticker];
    const weight = input.weightByTicker[agg.ticker];
    if (typeof weight === "number" && Number.isFinite(weight)) {
      weightByHoldingId[agg.firstId] = weight;
    }
    candidateHoldings.push({
      id: agg.firstId,
      ticker: agg.ticker,
      sector: agg.sector,
      quantity: agg.totalQty,
      buyScore: score?.buy ?? null,
      qualityGatePassed: score ? score.buy !== null : false,
      hasActiveOverride: score?.hidden.buy ?? false,
      annualDivGbp: holdingAnnualDivGbp(
        agg.ticker,
        agg.totalQty,
        input.quotesByTicker[agg.ticker],
        input.ratesToGbp,
      ),
    });
  }

  const candidates = buildSuggestions({
    triggerHoldingId: trigger.firstId,
    triggerPaymentGbp: trigger.estPaymentGbp ?? 0,
    holdings: candidateHoldings,
    totalPortfolioIncomeGbp: input.totalPortfolioIncomeGbp,
    sectorsToAvoid: input.sectorsToAvoid,
    currentWeightByHolding: weightByHoldingId,
    triggerSector: trigger.sector,
    limit: 10,
  });

  if (candidates.length === 0) return null;

  return {
    trigger: {
      holdingId: trigger.firstId,
      ticker: trigger.ticker,
      exDivDate: trigger.exDivDate,
      payDate: trigger.payDate,
      estPaymentGbp: trigger.estPaymentGbp,
      currentWeight: (() => {
        const w = input.weightByTicker[trigger.ticker];
        return typeof w === "number" && Number.isFinite(w) ? w : null;
      })(),
    },
    candidates,
  };
}

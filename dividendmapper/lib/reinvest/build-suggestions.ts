// Reinvest Recommender v1 — given a trigger dividend payment, rank the user's
// other holdings as places to redeploy the cash. Excludes the trigger itself,
// quality-gate failures, score-overridden holdings, and sectors the user wants
// to avoid. Returns the top 5 by reinvest score with a short reason string.

import type { SignalRecord } from "@/lib/scoring/compute-buy-score";
import { reinvestScore } from "./score";

export interface Holding {
  id: string;
  ticker: string;
  sector?: string | null;
  quantity: number;
  buyScore: number | null;
  qualityGatePassed: boolean;
  hasActiveOverride: boolean;
  annualDivGbp: number;
  signals?: SignalRecord[];
}

export interface SuggestionInputs {
  triggerHoldingId: string;
  triggerPaymentGbp: number;
  holdings: Holding[];
  totalPortfolioIncomeGbp: number;
  sectorsToAvoid?: string[];
}

export interface Suggestion {
  holdingId: string;
  ticker: string;
  buyScore: number;
  reinvestScore: number;
  reason: string;
}

function buildReason(candidate: Holding, sectorDiversificationDelta: number): string {
  const topContribs = (candidate.signals ?? [])
    .filter((s) => s.score != null && s.effectiveWeight > 0)
    .sort(
      (a, b) =>
        (b.score as number) * b.effectiveWeight - (a.score as number) * a.effectiveWeight,
    )
    .slice(0, 2)
    .map((s) => s.humanLabel);
  const diversification =
    sectorDiversificationDelta > 0
      ? `improves sector diversification by ${sectorDiversificationDelta.toFixed(0)}%`
      : null;
  return [...topContribs, diversification].filter(Boolean).join(" · ");
}

export function buildSuggestions(inputs: SuggestionInputs): Suggestion[] {
  const avoidSet = new Set((inputs.sectorsToAvoid ?? []).map((s) => s.toLowerCase()));
  const eligible = inputs.holdings.filter(
    (h) =>
      h.id !== inputs.triggerHoldingId &&
      h.buyScore != null &&
      h.qualityGatePassed &&
      !h.hasActiveOverride &&
      !(h.sector && avoidSet.has(h.sector.toLowerCase())),
  );

  const ranked = eligible.map((h) => {
    // Day-5 projection: scale the trigger payment by the candidate's annual
    // dividend per unit. A simple proxy; calibrated against real market value
    // in the Day-6 UI work.
    const projectedAdded = inputs.triggerPaymentGbp * (h.annualDivGbp / Math.max(1, h.quantity * 1));
    const rScore = reinvestScore({
      candidateBuyScore: h.buyScore as number,
      projectedAddedAnnualDivGbp: projectedAdded,
      totalPortfolioIncomeGbp: inputs.totalPortfolioIncomeGbp,
    });
    return {
      holdingId: h.id,
      ticker: h.ticker,
      buyScore: h.buyScore as number,
      reinvestScore: rScore,
      reason: buildReason(h, 0), // sector diversification delta deferred to Day 6 UI
    };
  });

  return ranked.sort((a, b) => b.reinvestScore - a.reinvestScore).slice(0, 5);
}

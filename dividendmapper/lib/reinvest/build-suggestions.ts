// Reinvest Recommender v1 — given a trigger dividend payment, rank the user's
// other holdings as places to redeploy the cash. Excludes the trigger itself,
// quality-gate failures, score-overridden holdings, and sectors the user wants
// to avoid. Returns the top 5 by reinvest score with a short reason string.

import type { SignalRecord } from "@/lib/scoring/compute-buy-score";
import { reinvestScore } from "./score";
import { concentrationFactor } from "./concentration-factor";

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
  /** Current portfolio weight (0..1) per holding id, from computeConcentration. */
  currentWeightByHolding?: Record<string, number>;
  /** Concentration threshold (default 0.20). */
  concentrationThreshold?: number;
  /** Max suggestions returned (default 10; the card shows 5 + "Show more"). */
  limit?: number;
  /** Sector of the trigger holding, to compute the sector-spread note. */
  triggerSector?: string | null;
}

export interface Suggestion {
  holdingId: string;
  ticker: string;
  buyScore: number;
  reinvestScore: number; // post-concentration, used for ranking
  currentWeight: number | null; // for the card copy ("9% of your portfolio")
  reason: string;
  diversificationNote: string | null; // hygiene clause for the copy
}

// One hygiene clause for the card copy. Never alpha; no em dashes.
function diversificationNote(args: {
  weight: number | null;
  threshold: number;
  candidateSector: string | null;
  triggerSector: string | null;
}): string | null {
  const { weight, threshold, candidateSector, triggerSector } = args;
  if (weight !== null && weight >= threshold) {
    return "already a large position";
  }
  if (
    candidateSector &&
    triggerSector &&
    candidateSector.toLowerCase() !== triggerSector.toLowerCase()
  ) {
    return "a different sector";
  }
  if (weight !== null && weight < threshold * 0.5) {
    return "one of your smaller positions";
  }
  return null;
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

  const threshold = inputs.concentrationThreshold ?? 0.2;
  const limit = inputs.limit ?? 10;
  const weights = inputs.currentWeightByHolding ?? {};

  const ranked = eligible.map((h) => {
    // Day-5 projection: scale the trigger payment by the candidate's annual
    // dividend per unit. A simple proxy for the income-contribution term.
    const projectedAdded = inputs.triggerPaymentGbp * (h.annualDivGbp / Math.max(1, h.quantity * 1));
    const base = reinvestScore({
      candidateBuyScore: h.buyScore as number,
      projectedAddedAnnualDivGbp: projectedAdded,
      totalPortfolioIncomeGbp: inputs.totalPortfolioIncomeGbp,
    });
    // Hygiene: demote candidates at/over the concentration cap, reward
    // under-weight ones, so "where does the cash go" spreads risk rather than
    // chasing the single highest Quality score.
    const weight = weights[h.id];
    const hasWeight = typeof weight === "number" && Number.isFinite(weight);
    const factor = hasWeight ? concentrationFactor(weight, threshold) : 1;
    const adjusted = Math.round(base * factor);
    return {
      holdingId: h.id,
      ticker: h.ticker,
      buyScore: h.buyScore as number,
      reinvestScore: adjusted,
      currentWeight: hasWeight ? weight : null,
      reason: buildReason(h, 0),
      diversificationNote: diversificationNote({
        weight: hasWeight ? weight : null,
        threshold,
        candidateSector: h.sector ?? null,
        triggerSector: inputs.triggerSector ?? null,
      }),
    };
  });

  return ranked.sort((a, b) => b.reinvestScore - a.reinvestScore).slice(0, limit);
}

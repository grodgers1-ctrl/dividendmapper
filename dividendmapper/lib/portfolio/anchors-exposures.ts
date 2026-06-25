import type { QuoteResult } from "@/lib/market/quote";
import type { ActualIncome } from "@/lib/portfolio/income";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import {
  classifyHolding,
  type IncomeBand,
} from "@/lib/scoring/income-band-helpers";
import { resolveRowIncome } from "@/lib/portfolio/row-income";

// Aggregates each vehicle holding's forward annual income into one of four
// income-resilience bands. Pure: takes already-loaded inputs from the
// dashboard server component and returns the rolled-up totals.
//
// Scope is REITs + BDCs + UK REITs only (matches the Phase 4 income-vehicle
// scoring engine). Holdings without a vehicle record are excluded from the
// bands and surfaced separately via excludedCount/excludedGbp so the card
// can footnote them without polluting Unscored.
//
// Income source is resolveRowIncome (forward estimate first, broker actuals
// as a fallback) so the totals match the Income column users already see on
// the holdings ledger.

export type IncomeBandTotalsGbp = Record<IncomeBand, number>;

export interface AnchorsExposuresInput {
  holdings: ReadonlyArray<{
    ticker: string;
    quantity: number | string;
    wrapper: string;
  }>;
  quotes: Record<string, QuoteResult>;
  actualsByKey?: Record<string, ActualIncome>;
  vehicleScoresByTicker: Record<
    string,
    {
      vehicleType: VehicleType;
      resilienceScore: number | null;
      qualityGatePassed: boolean;
    }
  >;
  ratesToGbp: Readonly<Record<string, number>>;
}

export interface AnchorsExposuresResult {
  totalsGbp: IncomeBandTotalsGbp;
  countsByBand: Record<IncomeBand, number>;
  totalGbp: number;
  inScopeCount: number;
  excludedCount: number;
  excludedGbp: number;
}

const EMPTY: AnchorsExposuresResult = {
  totalsGbp: { anchor: 0, exposure: 0, risk: 0, unscored: 0 },
  countsByBand: { anchor: 0, exposure: 0, risk: 0, unscored: 0 },
  totalGbp: 0,
  inScopeCount: 0,
  excludedCount: 0,
  excludedGbp: 0,
};

export function aggregateIncomeByBand(
  input: AnchorsExposuresInput,
): AnchorsExposuresResult {
  if (input.holdings.length === 0) return EMPTY;

  const totalsGbp: IncomeBandTotalsGbp = { anchor: 0, exposure: 0, risk: 0, unscored: 0 };
  const countsByBand: Record<IncomeBand, number> = {
    anchor: 0,
    exposure: 0,
    risk: 0,
    unscored: 0,
  };
  let inScopeCount = 0;
  let excludedCount = 0;
  let excludedGbp = 0;

  for (const h of input.holdings) {
    const vehicle = input.vehicleScoresByTicker[h.ticker];
    const income = resolveRowIncome(h, input.quotes, input.actualsByKey);
    const rate =
      income.kind === "ok" ? input.ratesToGbp[income.currency] : undefined;
    const gbp =
      income.kind === "ok" &&
      typeof rate === "number" &&
      Number.isFinite(rate) &&
      rate > 0
        ? income.amount * rate
        : 0;

    if (!vehicle) {
      excludedCount += 1;
      excludedGbp += gbp;
      continue;
    }

    inScopeCount += 1;
    const band: IncomeBand = classifyHolding({
      vehicleType: vehicle.vehicleType,
      resilienceScore: vehicle.resilienceScore,
      buyScore: null,
      qualityGatePassed: vehicle.qualityGatePassed,
    });
    countsByBand[band] += 1;
    totalsGbp[band] += gbp;
  }

  const totalGbp =
    totalsGbp.anchor + totalsGbp.exposure + totalsGbp.risk + totalsGbp.unscored;
  return {
    totalsGbp,
    countsByBand,
    totalGbp,
    inScopeCount,
    excludedCount,
    excludedGbp,
  };
}

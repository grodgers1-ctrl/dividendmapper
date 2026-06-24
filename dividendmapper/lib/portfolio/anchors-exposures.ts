import type { QuoteResult } from "@/lib/market/quote";
import type { ActualIncome } from "@/lib/portfolio/income";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import {
  classifyHolding,
  type IncomeBand,
} from "@/lib/scoring/income-band-helpers";
import { resolveRowIncome } from "@/lib/portfolio/row-income";

// Aggregates each holding's forward annual income into one of four
// income-resilience bands. Pure: takes already-loaded inputs from the
// dashboard server component and returns the rolled-up totals.
//
// Income source is resolveRowIncome (forward estimate first, broker actuals
// as a fallback) so the totals match the Income column users already see on
// the holdings ledger.

export type IncomeBandTotalsGbp = Record<IncomeBand, number>;

export interface BandBreakdownRow {
  band: IncomeBand;
  totalGbp: number;
  holdingCount: number;
}

export interface AnchorsExposuresInput {
  holdings: ReadonlyArray<{
    ticker: string;
    quantity: number | string;
    wrapper: string;
  }>;
  quotes: Record<string, QuoteResult>;
  actualsByKey?: Record<string, ActualIncome>;
  scoresByTicker: Record<string, HoldingScore>;
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
}

const EMPTY: AnchorsExposuresResult = {
  totalsGbp: { anchor: 0, exposure: 0, risk: 0, unscored: 0 },
  countsByBand: { anchor: 0, exposure: 0, risk: 0, unscored: 0 },
  totalGbp: 0,
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

  for (const h of input.holdings) {
    const vehicle = input.vehicleScoresByTicker[h.ticker];
    const equityScore = input.scoresByTicker[h.ticker];

    const band: IncomeBand = classifyHolding({
      vehicleType: vehicle ? vehicle.vehicleType : "equity",
      resilienceScore: vehicle?.resilienceScore ?? null,
      buyScore: vehicle ? null : (equityScore?.buy ?? null),
      qualityGatePassed: vehicle
        ? vehicle.qualityGatePassed
        : (equityScore?.buyFailedGates ?? []).length === 0,
    });

    countsByBand[band] += 1;

    const income = resolveRowIncome(h, input.quotes, input.actualsByKey);
    if (income.kind !== "ok") continue;
    const rate = input.ratesToGbp[income.currency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
    totalsGbp[band] += income.amount * rate;
  }

  const totalGbp =
    totalsGbp.anchor + totalsGbp.exposure + totalsGbp.risk + totalsGbp.unscored;
  return { totalsGbp, countsByBand, totalGbp };
}

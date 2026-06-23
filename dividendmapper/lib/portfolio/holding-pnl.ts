// Per-holding P/L in GBP. Pure helper driving the dashboard's Best & Worst
// position card. Mirrors PositionCard's cross-currency math: convert both
// cost (qty × avg_cost in cost_currency) and value (qty × price in value
// currency) to GBP via the shared ratesToGbp map. Rows without a price,
// with cost ≤ 0, or with a missing/invalid rate on either side are dropped
// rather than producing a bogus number.

import type { TickerPrice } from "@/lib/portfolio/row-value";

export interface PnlHolding {
  ticker: string;
  quantity: number | string;
  avg_cost: number;
  cost_currency: string;
}

export interface HoldingPnl {
  ticker: string;
  /** Signed lifetime P/L in GBP. */
  deltaGbp: number;
  /** Signed lifetime return as a decimal (0.12 = +12%). */
  pctGbp: number;
  /** True when cost and value are in different currencies — drives the
   *  "FX as of today" caveat in the card. */
  isCrossCurrency: boolean;
}

function isUsableRate(rate: number | undefined): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

export function computeHoldingsPnl<T extends PnlHolding>(
  holdings: ReadonlyArray<T>,
  priceByTicker: Record<string, TickerPrice>,
  ratesToGbp: Readonly<Record<string, number>>,
): HoldingPnl[] {
  const out: HoldingPnl[] = [];
  for (const h of holdings) {
    const p = priceByTicker[h.ticker];
    if (!p || !(p.price > 0) || !p.currency) continue;
    if (!(h.avg_cost > 0)) continue;

    const qty = typeof h.quantity === "string" ? Number(h.quantity) : h.quantity;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const costRate = ratesToGbp[h.cost_currency];
    const valueRate = ratesToGbp[p.currency];
    if (!isUsableRate(costRate) || !isUsableRate(valueRate)) continue;

    const costGbp = qty * h.avg_cost * costRate;
    const valueGbp = qty * p.price * valueRate;
    if (!Number.isFinite(costGbp) || costGbp <= 0) continue;
    if (!Number.isFinite(valueGbp)) continue;

    const deltaGbp = valueGbp - costGbp;
    out.push({
      ticker: h.ticker,
      deltaGbp,
      pctGbp: deltaGbp / costGbp,
      isCrossCurrency: h.cost_currency !== p.currency,
    });
  }
  return out;
}

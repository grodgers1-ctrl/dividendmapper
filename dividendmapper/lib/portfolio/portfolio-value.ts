import {
  resolveRowValue,
  type RowValueHolding,
  type TickerPrice,
} from "@/lib/portfolio/row-value";

// Per-currency portfolio value roll-up (quantity × price), mirroring the income
// chart's source-currency bucketing — no FX conversion. Pure.

export interface ValueCurrencyTotal {
  currency: string;
  total: number;
}

export function aggregatePortfolioValue<T extends RowValueHolding>(
  holdings: ReadonlyArray<T>,
  priceByTicker: Record<string, TickerPrice>,
): { totalsByCurrency: ValueCurrencyTotal[] } {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    const v = resolveRowValue(h, priceByTicker);
    if (v.kind !== "ok") continue;
    totals.set(v.currency, (totals.get(v.currency) ?? 0) + v.amount);
  }
  return {
    totalsByCurrency: Array.from(totals.entries())
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => b.total - a.total),
  };
}

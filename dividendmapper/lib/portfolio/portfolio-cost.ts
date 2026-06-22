// Per-currency portfolio cost-basis roll-up (quantity × avg_cost), bucketed by
// cost_currency. Mirrors aggregatePortfolioValue at portfolio-value.ts — kept
// separate to avoid pulling row-value's price-resolution machinery into a path
// that only needs the holding's own cost fields.

export interface CostHolding {
  quantity: number | string;
  avg_cost: number;
  cost_currency: string;
}

export interface CostCurrencyTotal {
  currency: string;
  total: number;
}

export function aggregatePortfolioCost<T extends CostHolding>(
  holdings: ReadonlyArray<T>,
): { totalsByCurrency: CostCurrencyTotal[] } {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    if (!(h.avg_cost > 0)) continue;
    const qty = typeof h.quantity === "string" ? Number(h.quantity) : h.quantity;
    const product = qty * h.avg_cost;
    if (!Number.isFinite(product) || product <= 0) continue;
    totals.set(h.cost_currency, (totals.get(h.cost_currency) ?? 0) + product);
  }
  return {
    totalsByCurrency: Array.from(totals.entries())
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => b.total - a.total),
  };
}

/**
 * FX-convert per-currency cost totals to a single GBP figure. Same contract as
 * sumIncomeGbp in lib/portfolio/income.ts: rows whose currency is missing from
 * `ratesToGbp`, or whose rate is non-finite/non-positive, are silently dropped.
 * Returns 0 for an empty input.
 */
export function sumCostGbp(
  totals: ReadonlyArray<CostCurrencyTotal>,
  ratesToGbp: Readonly<Record<string, number>>,
): number {
  return totals.reduce((acc, row) => {
    const rate = ratesToGbp[row.currency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return acc;
    }
    return acc + row.total * rate;
  }, 0);
}

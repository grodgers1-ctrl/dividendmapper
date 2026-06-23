// Pure helper for the per-holding "Yield on Cost" figure rendered by
// app/app/portfolio/[ticker]/_components/IncomeCard. UK holdings price
// dividends in pence (GBp/GBX) while broker-imported cost basis is in
// pounds (GBP); a naive same-currency equality on those strings always
// fails, which is why every .L holding showed YoC blank pre-fix.

export interface ComputeYieldOnCostInput {
  forwardAnnual: number | null;
  forwardCurrency: string | null;
  quantity: number;
  avgCost: number;
  costCurrency: string;
}

/**
 * Returns the yield-on-cost as a percentage (e.g. 3.79 means 3.79%) or null
 * when the inputs cannot be resolved into a same-currency ratio.
 *
 * Supported currency combinations:
 *   - <X> dividend, <X> cost     → direct.
 *   - GBp/GBX dividend, GBP cost → dividend / 100 then direct.
 *   - everything else            → null (we don't apply live FX inside YoC).
 */
export function computeYieldOnCost(input: ComputeYieldOnCostInput): number | null {
  const { forwardAnnual, forwardCurrency, quantity, avgCost, costCurrency } = input;
  if (
    forwardAnnual === null ||
    !Number.isFinite(forwardAnnual) ||
    forwardAnnual <= 0
  ) {
    return null;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(avgCost) || avgCost <= 0) return null;
  if (forwardCurrency === null) return null;

  const isPence = forwardCurrency === "GBp" || forwardCurrency === "GBX";
  const dividendInCostCurrency =
    isPence && costCurrency === "GBP"
      ? forwardAnnual / 100
      : forwardCurrency === costCurrency
        ? forwardAnnual
        : null;

  if (dividendInCostCurrency === null) return null;
  return (dividendInCostCurrency / (quantity * avgCost)) * 100;
}

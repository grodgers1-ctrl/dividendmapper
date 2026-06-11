import type { QuoteResult } from "@/lib/market/quote";
import { actualKey, type ActualIncome } from "@/lib/portfolio/income";

// Per-holding income for the holdings table. The "income/yr" column is a
// FORWARD annual run-rate, so it uses the FMP-sourced estimate (latest annual
// dividend-per-share × quantity) carried on the quote. A broker-synced actual
// is only a fallback for tickers FMP doesn't score: actuals are a trailing sum
// that under-reports for any position bought partway through the year, so they
// must not override the estimate under an "/yr" label. Pure.

export type RowIncomeStatus =
  | { kind: "ok"; amount: number; currency: string; source: "actual" | "estimate" }
  | { kind: "no_data" }
  | { kind: "failed" };

export interface RowIncomeHolding {
  ticker: string;
  quantity: number | string;
  wrapper: string;
}

export function resolveRowIncome(
  row: RowIncomeHolding,
  quotes: Record<string, QuoteResult>,
  actualsByKey?: Record<string, ActualIncome>,
): RowIncomeStatus {
  // Forward estimate wins — it's the figure the "/yr" label promises.
  const quote = quotes[row.ticker];
  if (quote?.ok) {
    const { dividend, currency } = quote.data;
    if (dividend && dividend > 0 && currency) {
      const annual = Number(row.quantity) * dividend;
      if (Number.isFinite(annual) && annual > 0) {
        return { kind: "ok", amount: annual, currency, source: "estimate" };
      }
    }
  }

  // No forward estimate (FMP doesn't score this ticker) — fall back to the
  // holding's real synced dividends so the row isn't blank.
  const actual = actualsByKey?.[actualKey(row.ticker, row.wrapper)];
  if (actual && actual.amount > 0 && actual.currency) {
    return { kind: "ok", amount: actual.amount, currency: actual.currency, source: "actual" };
  }

  // Neither estimate nor actual: distinguish a failed fetch from genuine no-data.
  if (!quote || !quote.ok) return { kind: "failed" };
  return { kind: "no_data" };
}

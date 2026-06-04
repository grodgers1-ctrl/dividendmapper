import type { QuoteResult } from "@/lib/market/quote";
import { actualKey, type ActualIncome } from "@/lib/portfolio/income";

// Per-holding income for the holdings table. Mirrors the chart's logic at the
// row level: prefer the holding's real synced dividends (TTM actuals), else
// fall back to the FMP-sourced estimate carried on the quote. Pure.

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
  // Real synced dividends win.
  const actual = actualsByKey?.[actualKey(row.ticker, row.wrapper)];
  if (actual && actual.amount > 0 && actual.currency) {
    return { kind: "ok", amount: actual.amount, currency: actual.currency, source: "actual" };
  }

  const quote = quotes[row.ticker];
  if (!quote || !quote.ok) return { kind: "failed" };
  const { dividend, currency } = quote.data;
  if (!dividend || dividend <= 0 || !currency) return { kind: "no_data" };
  const annual = Number(row.quantity) * dividend;
  if (!Number.isFinite(annual) || annual <= 0) return { kind: "no_data" };
  return { kind: "ok", amount: annual, currency, source: "estimate" };
}

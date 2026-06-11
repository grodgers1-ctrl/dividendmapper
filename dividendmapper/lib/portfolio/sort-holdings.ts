import type { QuoteResult } from "@/lib/market/quote";
import type { ActualIncome } from "@/lib/portfolio/income";
import { resolveRowIncome } from "@/lib/portfolio/row-income";
import { resolveRowValue, type TickerPrice } from "@/lib/portfolio/row-value";

// Pure sort for the holdings table. Numeric keys (value/income/score/date) sort
// DESC with missing values last; text keys (ticker/wrapper) sort A–Z. Currencies
// aren't FX-normalised for value/income — it's a rough ordering, not a valuation.

export type SortKey = "value" | "income" | "score" | "date" | "ticker" | "wrapper";

export const SORT_LABELS: Record<SortKey, string> = {
  value: "Value",
  income: "Income",
  score: "Quality score",
  date: "Date added",
  ticker: "Ticker (A–Z)",
  wrapper: "Wrapper",
};

export const DEFAULT_SORT: SortKey = "value";

export interface SortableHolding {
  ticker: string;
  quantity: number | string;
  wrapper: string;
  created_at: string;
}

export interface SortContext {
  priceByTicker?: Record<string, TickerPrice>;
  quotes?: Record<string, QuoteResult>;
  actualsByKey?: Record<string, ActualIncome>;
  buyScoreByTicker?: Record<string, number | null>;
}

function numericValue(
  row: SortableHolding,
  key: SortKey,
  ctx: SortContext,
): number | null {
  switch (key) {
    case "value": {
      const v = resolveRowValue(row, ctx.priceByTicker ?? {});
      return v.kind === "ok" ? v.amount : null;
    }
    case "income": {
      const i = resolveRowIncome(row, ctx.quotes ?? {}, ctx.actualsByKey);
      return i.kind === "ok" ? i.amount : null;
    }
    case "score":
      return ctx.buyScoreByTicker?.[row.ticker] ?? null;
    case "date": {
      const t = new Date(row.created_at).getTime();
      return Number.isFinite(t) ? t : null;
    }
    default:
      return null;
  }
}

export function sortHoldings<T extends SortableHolding>(
  rows: ReadonlyArray<T>,
  key: SortKey,
  ctx: SortContext,
): T[] {
  const copy = [...rows];
  if (key === "ticker") {
    return copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }
  if (key === "wrapper") {
    return copy.sort(
      (a, b) => a.wrapper.localeCompare(b.wrapper) || a.ticker.localeCompare(b.ticker),
    );
  }
  // Numeric, descending, with nulls (missing data) sorted to the end.
  return copy.sort((a, b) => {
    const av = numericValue(a, key, ctx);
    const bv = numericValue(b, key, ctx);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });
}

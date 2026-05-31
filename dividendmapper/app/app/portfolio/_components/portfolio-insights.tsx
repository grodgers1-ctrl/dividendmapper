"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";

// One compact panel that merges the two advisory banners: score-flagged
// holdings (action hints) and the concentration check. Keeps the portfolio
// view from stacking three separate alert boxes above the table.

export interface PortfolioInsightsProps {
  flagged: { ticker: string; hint: string }[];
  overweight: { ticker: string; weight: number }[];
  threshold: number;
}

function groupByHint(flagged: { ticker: string; hint: string }[]): [string, string[]][] {
  const map = new Map<string, string[]>();
  for (const { ticker, hint } of flagged) {
    const list = map.get(hint) ?? [];
    list.push(ticker);
    map.set(hint, list);
  }
  return [...map.entries()];
}

export function PortfolioInsights({ flagged, overweight, threshold }: PortfolioInsightsProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (flagged.length === 0 && overweight.length === 0)) return null;

  const groups = groupByHint(flagged);
  const count = flagged.length;
  const thresholdPct = Math.round(threshold * 100);

  return (
    <div
      role="status"
      className="rounded-lg border border-brand-500/30 bg-brand-50 px-4 py-2.5 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {count > 0 && (
            <p className="min-w-0">
              <span className="font-display font-semibold">
                {count} holding{count === 1 ? "" : "s"} flagged:
              </span>{" "}
              {groups.map(([hint, tickers], i) => (
                <span key={hint}>
                  {i > 0 && <span className="text-muted-foreground"> · </span>}
                  <span className="font-mono">{tickers.join(", ")}</span>{" "}
                  <span className="text-muted-foreground">({hint})</span>
                </span>
              ))}{" "}
              <Link
                href="/app/portfolio/scoring"
                className="whitespace-nowrap font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                View all scores →
              </Link>
            </p>
          )}

          {overweight.length > 0 && (
            <p className="text-muted-foreground">
              {overweight.length === 1 ? (
                <>
                  <span className="font-mono text-foreground">
                    {overweight[0].ticker}
                  </span>{" "}
                  is {Math.round(overweight[0].weight * 100)}% of your portfolio. A
                  holding above {thresholdPct}% concentrates your income and capital
                  on one company.
                </>
              ) : (
                <>
                  {overweight.map((p, i) => (
                    <span key={p.ticker}>
                      {i > 0 && i < overweight.length - 1 && ", "}
                      {i > 0 && i === overweight.length - 1 && " and "}
                      <span className="font-mono text-foreground">{p.ticker}</span> (
                      {Math.round(p.weight * 100)}%)
                    </span>
                  ))}{" "}
                  each exceed {thresholdPct}% of your portfolio, concentrating your
                  income on a few companies.
                </>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

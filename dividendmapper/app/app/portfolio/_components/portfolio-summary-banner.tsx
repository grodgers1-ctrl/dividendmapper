"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";

export interface PortfolioSummaryBannerProps {
  flagged: { ticker: string; hint: string }[];
}

// Groups flagged holdings by their action hint so the banner reads
// "3 holdings flagged: PEP, PYPL (Add more) · SCHD (Review urgently)".
function groupByHint(flagged: { ticker: string; hint: string }[]): [string, string[]][] {
  const map = new Map<string, string[]>();
  for (const { ticker, hint } of flagged) {
    const list = map.get(hint) ?? [];
    list.push(ticker);
    map.set(hint, list);
  }
  return [...map.entries()];
}

export function PortfolioSummaryBanner({ flagged }: PortfolioSummaryBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (flagged.length === 0 || dismissed) return null;

  const groups = groupByHint(flagged);
  const count = flagged.length;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
    >
      <div className="min-w-0">
        <span className="font-display font-semibold">
          {count} holding{count === 1 ? "" : "s"} flagged:
        </span>{" "}
        {groups.map(([hint, tickers], i) => (
          <span key={hint}>
            {i > 0 && <span className="text-muted-foreground"> · </span>}
            <span className="font-mono">{tickers.join(", ")}</span>{" "}
            <span className="text-muted-foreground">({hint})</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/app/portfolio/scoring"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          View all scores
          <span aria-hidden>→</span>
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

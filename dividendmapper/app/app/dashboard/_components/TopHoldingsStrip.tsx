// Day 5 dashboard. Top-5 holdings by value (FX-blind raw-amount sort — same
// behaviour as the Ledger value column). Free tier omits the chip column
// entirely (no blur-and-tease per Day 5 plan); Pro renders a Buy/Quality
// chip when the score exists for that ticker.

import Link from "next/link";
import { resolveRowValue, type TickerPrice } from "@/lib/portfolio/row-value";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";
import { ScoreChip } from "@/app/app/portfolio/_components/score-chip";
import type { FlaggableScore } from "@/lib/scoring/pick-flagged";

export interface TopHoldingsStripProps {
  holdings: ReadonlyArray<HoldingRow>;
  priceByTicker: Record<string, TickerPrice>;
  nameByTicker: Record<string, string>;
  scores: ReadonlyMap<string, FlaggableScore>;
  tier: "free" | "pro" | "premium";
}

const TOP_N = 5;

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function format(amount: number, currency: string): string {
  let f = FORMATTERS.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    FORMATTERS.set(currency, f);
  }
  return f.format(amount);
}

export function TopHoldingsStrip({
  holdings,
  priceByTicker,
  nameByTicker,
  scores,
  tier,
}: TopHoldingsStripProps) {
  const isPro = tier !== "free";

  const priced = holdings
    .map((h) => {
      const v = resolveRowValue(h, priceByTicker);
      if (v.kind !== "ok") return null;
      return { holding: h, amount: v.amount, currency: v.currency };
    })
    .filter((row): row is { holding: HoldingRow; amount: number; currency: string } => row !== null);

  if (priced.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
        <p className="text-sm text-[var(--text-muted)]">No priced holdings to show yet.</p>
      </div>
    );
  }

  priced.sort((a, b) => b.amount - a.amount);
  const top = priced.slice(0, TOP_N);

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight text-[var(--text)]">
          Top holdings
        </h2>
      </div>
      <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
        {top.map(({ holding, amount, currency }) => {
          const name = nameByTicker[holding.ticker] ?? holding.ticker;
          const score = isPro ? scores.get(holding.ticker) : undefined;
          return (
            <li
              key={holding.id}
              className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 py-2.5 text-sm sm:grid-cols-[5.5rem_1fr_auto_auto]"
            >
              <span className="font-mono text-[13px] font-semibold tracking-wide text-[var(--text)]">
                {holding.ticker}
              </span>
              <span className="truncate text-[var(--text-muted)]">{name}</span>
              <span className="font-mono tabular-nums text-[var(--text)]">
                {format(amount, currency)}
              </span>
              {isPro && (
                <span className="hidden sm:inline-flex">
                  {score && score.buy !== null ? (
                    <ScoreChip type="buy" score={score.buy} />
                  ) : (
                    <span aria-hidden className="inline-block h-4 w-12" />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 text-right">
        <Link
          href="/app/portfolio"
          className="text-sm text-[var(--brand)] hover:underline"
        >
          View all holdings →
        </Link>
      </div>
    </div>
  );
}

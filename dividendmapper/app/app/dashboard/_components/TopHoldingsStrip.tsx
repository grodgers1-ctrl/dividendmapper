"use client";

// Day 5 dashboard. Top-5 holdings by GBP-equivalent value. Free tier omits
// the chip column entirely (no blur-and-tease per Day 5 plan); Pro renders a
// Buy/Quality chip when the score exists for that ticker.
//
// Holdings are displayed in their source currency (matches the Ledger and
// what the user sees in their broker). Ranking uses GBP equivalents so a
// £100k US position outranks a £50k UK position even though the raw amounts
// (in USD and GBP) would mis-order them without conversion.
//
// Quick-wins sprint adds a per-row fundamentals chip strip (P/E · Yield ·
// Payout) under each top holding for Pro users — hidden on mobile and
// omitted whenever the data is null. Animation matches SignalContributionsList:
// per-chip fade-and-rise with row+chip stagger.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { resolveRowValue, type TickerPrice } from "@/lib/portfolio/row-value";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";
import { ScoreChip } from "@/app/app/portfolio/_components/score-chip";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";
import type { FlaggableScore } from "@/lib/scoring/pick-flagged";

// Grid templates shared by the header row and each data row so values + chips
// stack cleanly into proper columns. `minmax(0,1fr)` lets the name column
// truncate instead of pushing value/quality off the right. Mobile uses a
// tighter logo/ticker/value to leave room for the truncated name.
const GRID_MOBILE = "grid-cols-[2rem_4.5rem_minmax(0,1fr)_5rem] gap-3";
const GRID_SM_FREE = "sm:grid-cols-[2.5rem_5rem_minmax(0,1fr)_6rem] sm:gap-4";
const GRID_SM_PRO = "sm:grid-cols-[2.5rem_5rem_minmax(0,1fr)_6rem_5.5rem] sm:gap-4";

export interface TopHoldingsStripProps {
  holdings: ReadonlyArray<HoldingRow>;
  priceByTicker: Record<string, TickerPrice>;
  nameByTicker: Record<string, string>;
  scores: ReadonlyMap<string, FlaggableScore>;
  tier: "free" | "pro" | "premium";
  /** currency → GBP multiplier from ratesToGbpFor(). Optional: a missing rate
   *  for a row's currency falls back to raw amount for sorting (degrades to the
   *  pre-FX behaviour for that one row rather than dropping it). */
  ratesToGbp?: Readonly<Record<string, number>>;
  /** Pro-only per-ticker fundamentals — Free tier never sees these even when
   *  the prop is supplied. Nullable fields render as omitted chips. */
  fundamentalsByTicker?: Readonly<
    Record<
      string,
      {
        forwardPe: number | null;
        payoutRatio: number | null;
        dividendYield: number | null;
      }
    >
  >;
}

const TOP_N = 5;
const EASE = [0.22, 1, 0.36, 1] as const;
const ROW_STAGGER = 0.08;
const CHIP_STAGGER = 0.04;

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

const PCT_1DP = new Intl.NumberFormat("en-GB", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const PCT_0DP = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

interface ChipDef {
  label: string;
  value: string;
}

function buildChips(fundamentals: {
  forwardPe: number | null;
  payoutRatio: number | null;
  dividendYield: number | null;
}): ChipDef[] {
  const out: ChipDef[] = [];
  if (typeof fundamentals.forwardPe === "number" && Number.isFinite(fundamentals.forwardPe)) {
    out.push({ label: "P/E", value: fundamentals.forwardPe.toFixed(1) });
  }
  if (
    typeof fundamentals.dividendYield === "number" &&
    Number.isFinite(fundamentals.dividendYield) &&
    fundamentals.dividendYield > 0
  ) {
    out.push({ label: "Yield", value: PCT_1DP.format(fundamentals.dividendYield) });
  }
  if (
    typeof fundamentals.payoutRatio === "number" &&
    Number.isFinite(fundamentals.payoutRatio) &&
    fundamentals.payoutRatio > 0
  ) {
    out.push({ label: "Payout", value: PCT_0DP.format(fundamentals.payoutRatio) });
  }
  return out;
}

export function TopHoldingsStrip({
  holdings,
  priceByTicker,
  nameByTicker,
  scores,
  tier,
  ratesToGbp,
  fundamentalsByTicker,
}: TopHoldingsStripProps) {
  const isPro = tier !== "free";
  const reduce = useReducedMotion();

  const priced = holdings
    .map((h) => {
      const v = resolveRowValue(h, priceByTicker);
      if (v.kind !== "ok") return null;
      const rate = ratesToGbp?.[v.currency];
      const sortKey =
        typeof rate === "number" && Number.isFinite(rate) && rate > 0
          ? v.amount * rate
          : v.amount;
      return { holding: h, amount: v.amount, currency: v.currency, sortKey };
    })
    .filter(
      (row): row is { holding: HoldingRow; amount: number; currency: string; sortKey: number } =>
        row !== null,
    );

  if (priced.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
        <p className="text-sm text-[var(--text-muted)]">No priced holdings to show yet.</p>
      </div>
    );
  }

  priced.sort((a, b) => b.sortKey - a.sortKey);
  const top = priced.slice(0, TOP_N);

  const gridCols = `${GRID_MOBILE} ${isPro ? GRID_SM_PRO : GRID_SM_FREE}`;

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight text-[var(--text)]">
          Top holdings
        </h2>
      </div>
      <div
        aria-hidden
        className={`mt-4 hidden ${gridCols} items-baseline pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] sm:grid`}
      >
        <span />
        <span>Ticker</span>
        <span>Name</span>
        <span className="text-right">Value</span>
        {isPro && <span className="text-right">Quality</span>}
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {top.map(({ holding, amount, currency }, rowIdx) => {
          const name = nameByTicker[holding.ticker] ?? holding.ticker;
          const score = isPro ? scores.get(holding.ticker) : undefined;
          const chips =
            isPro && fundamentalsByTicker?.[holding.ticker]
              ? buildChips(fundamentalsByTicker[holding.ticker])
              : [];
          return (
            <li key={holding.id} className="flex flex-col py-2.5">
              <Link
                href={`/app/portfolio/${holding.ticker}`}
                className={`grid ${gridCols} items-center text-sm hover:bg-[var(--surface-2)]`}
              >
                <HoldingLogo ticker={holding.ticker} name={name} size={32} />
                <span className="font-mono text-[13px] font-semibold tracking-wide text-[var(--text)]">
                  {holding.ticker}
                </span>
                <span className="truncate text-[var(--text-muted)]">{name}</span>
                <span className="text-right font-mono tabular-nums text-[var(--text)]">
                  {format(amount, currency)}
                </span>
                {isPro && (
                  <span className="hidden justify-self-end sm:inline-flex">
                    {score && score.buy !== null ? (
                      <ScoreChip type="buy" score={score.buy} />
                    ) : (
                      <span aria-hidden className="inline-block h-4 w-12" />
                    )}
                  </span>
                )}
              </Link>
              {chips.length > 0 && (
                <div className="ml-[9.5rem] mt-1.5 hidden gap-1.5 sm:flex">
                  {chips.map((chip, chipIdx) => (
                    <motion.span
                      key={chip.label}
                      data-testid="fundamentals-chip"
                      className="inline-flex items-baseline gap-1 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px]"
                      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduce ? 0 : 0.35,
                        delay: reduce
                          ? 0
                          : rowIdx * ROW_STAGGER + chipIdx * CHIP_STAGGER,
                        ease: EASE,
                      }}
                    >
                      <span className="uppercase tracking-wider text-[var(--text-muted)]">
                        {chip.label}
                      </span>
                      <span className="font-mono tabular-nums text-[var(--text)]">
                        {chip.value}
                      </span>
                    </motion.span>
                  ))}
                </div>
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

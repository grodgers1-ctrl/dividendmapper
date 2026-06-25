// Anchors vs Exposures, Pro-gated dashboard card that buckets the user's
// forward annual income from REITs and BDCs into resilience bands. Read-only
// in V1; the underlying classification is the V1.1 hook for personalised
// "rebalance toward anchors" suggestions.
//
// Scope is the Phase 4 income-vehicle universe (US REITs, US BDCs, UK REITs).
// Equities and anything else are excluded from the bands and surfaced via the
// excludedCount footnote.

import Link from "next/link";
import type { IncomeBand } from "@/lib/scoring/income-band-helpers";
import { AnchorsOrb } from "./anchors-orb";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export interface AnchorsExposuresCardProps {
  totalsGbp: Record<IncomeBand, number>;
  countsByBand: Record<IncomeBand, number>;
  totalGbp: number;
  inScopeCount: number;
  excludedCount: number;
}

export function AnchorsExposuresCard({
  totalsGbp,
  countsByBand,
  totalGbp,
  inScopeCount,
  excludedCount,
}: AnchorsExposuresCardProps) {
  const pendingCount = countsByBand.unscored;
  const pendingGbp = totalsGbp.unscored;
  const scoredGbp = totalsGbp.anchor + totalsGbp.exposure + totalsGbp.risk;

  return (
    <div className="rounded-[10px] border border-border bg-card p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-foreground">
          Anchors vs Exposures
        </h3>
        {totalGbp > 0 ? (
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            {GBP.format(Math.round(totalGbp))}/yr
          </p>
        ) : null}
      </div>

      {scoredGbp > 0 ? (
        <div className="mt-5 flex justify-center">
          <AnchorsOrb
            totalsGbp={totalsGbp}
            countsByBand={countsByBand}
            totalGbp={scoredGbp}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Your {inScopeCount} REIT and BDC holding{inScopeCount === 1 ? " is" : "s are"}{" "}
          queued for scoring. Check back after the next run.
        </p>
      )}

      {pendingCount > 0 && scoredGbp > 0 ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          + {GBP.format(Math.round(pendingGbp))}/yr across {pendingCount} holding
          {pendingCount === 1 ? "" : "s"} pending scoring
        </p>
      ) : null}

      <p className="mt-5 text-[0.7rem] leading-relaxed text-muted-foreground/70">
        Anchors earn durable rent; exposures earn higher yield with more cut
        risk. Covers REITs and BDCs only.
        {excludedCount > 0 ? (
          <>
            {" "}
            {excludedCount} other holding{excludedCount === 1 ? " is" : "s are"}{" "}
            outside this scope and not shown.
          </>
        ) : null}{" "}
        Not financial advice.{" "}
        <Link
          href="/methodology/income-vehicles"
          className="underline underline-offset-2 hover:text-foreground"
        >
          How resilience is calculated
        </Link>
        .
      </p>
    </div>
  );
}

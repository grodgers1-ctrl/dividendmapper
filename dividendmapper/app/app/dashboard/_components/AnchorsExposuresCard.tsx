// Anchors vs Exposures — Pro-gated dashboard card that buckets the user's
// forward annual income by resilience band. Read-only in V1; the underlying
// classification is the V1.1 hook for personalised "rebalance toward anchors"
// suggestions.
//
// Visual: a 4-segment horizontal stacked bar using the resilience ramp tokens
// (sage / sand / brick / muted-grey) + per-band rows with £/yr counts.

import Link from "next/link";
import type { IncomeBand } from "@/lib/scoring/income-band-helpers";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const BAND_ORDER: IncomeBand[] = ["anchor", "exposure", "risk", "unscored"];

const BAND_META: Record<
  IncomeBand,
  { label: string; barColor: string; description: string }
> = {
  anchor: {
    label: "Anchors",
    barColor: "var(--color-resilience-5)", // petrol — resilient
    description: "Durable rent — high-resilience income vehicles and quality equities.",
  },
  exposure: {
    label: "Exposures",
    barColor: "var(--color-resilience-3)", // sand — neutral
    description: "Higher yield, more cut risk. Moderate resilience or quality.",
  },
  risk: {
    label: "Risk",
    barColor: "var(--color-resilience-1)", // brick — cut risk
    description: "Low resilience or quality, or a failed quality gate.",
  },
  unscored: {
    label: "Unscored",
    barColor: "#94a3b8",
    description: "No score yet — newly added or outside the V1 universe.",
  },
};

export interface AnchorsExposuresCardProps {
  totalsGbp: Record<IncomeBand, number>;
  countsByBand: Record<IncomeBand, number>;
}

export function AnchorsExposuresCard({
  totalsGbp,
  countsByBand,
}: AnchorsExposuresCardProps) {
  const totalGbp =
    totalsGbp.anchor + totalsGbp.exposure + totalsGbp.risk + totalsGbp.unscored;

  if (totalGbp <= 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-6 shadow-[var(--card-shadow)]">
        <h3 className="font-display text-base font-semibold text-foreground">
          Anchors vs Exposures
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Once your holdings are priced and scored, this card splits your forward
          annual income into anchors (durable rent), exposures (higher yield, more
          cut risk), and risk. Not financial advice.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-foreground">
          Anchors vs Exposures
        </h3>
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          {GBP.format(Math.round(totalGbp))}/yr
        </p>
      </div>

      {/* 4-segment stacked bar — widths are share-of-total. */}
      <div
        className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label="Forward annual income split by resilience band"
        data-testid="anchors-bar"
      >
        {BAND_ORDER.map((band) => {
          const share = totalsGbp[band] / totalGbp;
          if (share <= 0) return null;
          return (
            <div
              key={band}
              data-testid={`anchors-segment-${band}`}
              style={{
                width: `${share * 100}%`,
                backgroundColor: BAND_META[band].barColor,
              }}
              title={`${BAND_META[band].label}: ${GBP.format(Math.round(totalsGbp[band]))}/yr`}
            />
          );
        })}
      </div>

      <ul className="mt-5 space-y-3">
        {BAND_ORDER.map((band) => {
          const total = totalsGbp[band];
          const count = countsByBand[band];
          if (total <= 0 && count === 0) return null;
          return (
            <li key={band} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: BAND_META[band].barColor }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {BAND_META[band].label}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({count} holding{count === 1 ? "" : "s"})
                    </span>
                  </p>
                  <p className="font-mono text-sm tabular-nums text-foreground">
                    {GBP.format(Math.round(total))}/yr
                  </p>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {BAND_META[band].description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-[0.7rem] leading-relaxed text-muted-foreground/70">
        Anchors earn durable rent; exposures earn higher yield with more cut
        risk. Not financial advice.{" "}
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

// Day 7 holding detail. ResilienceCard renders the per-holding scoring
// summary — the same ScoreOrb gauge + Quality/Trim/Risk chip stack that the
// dashboard's FlaggedHoldingCard and the ScoreDrawer use, plus a link to
// the public methodology page. Pro-only consumer; the page swaps to
// <UpgradeCard> for Free users.
//
// When the user owns a brand-new ticker that hasn't been scored yet (cron
// hasn't run), the empty state asks them to check back overnight, matching
// the Quadrant-map "Collecting…" convention.

import Link from "next/link";
import { ScoreOrb } from "@/app/app/portfolio/_components/score-orb";

export interface ResilienceCardProps {
  ticker: string;
  quality: number | null;
  trim: number | null;
  risk: number | null;
  qualityGateReason: string | null;
  isBeta: boolean;
}

export function ResilienceCard({
  ticker,
  quality,
  trim,
  risk,
  qualityGateReason,
  isBeta,
}: ResilienceCardProps) {
  const hasAnyScore = quality !== null || trim !== null || risk !== null;

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Resilience
      </p>
      {hasAnyScore ? (
        <>
          <div className="mt-3">
            <ScoreOrb
              ticker={ticker}
              quality={quality}
              trim={trim}
              risk={risk}
              qualityGateReason={qualityGateReason}
              size="md"
            />
          </div>
          {isBeta && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Scores in beta — weights tune monthly.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Scores collecting — check back overnight.
        </p>
      )}
      <div className="mt-4 text-right">
        <Link
          href={`/scoring/${ticker}`}
          className="text-sm text-[var(--brand)] hover:underline"
        >
          View public methodology →
        </Link>
      </div>
    </div>
  );
}

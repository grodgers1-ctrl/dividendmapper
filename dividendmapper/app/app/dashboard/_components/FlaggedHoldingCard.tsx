// Day 6 dashboard. Pro-only — Free users see <UpgradeCard> instead (composed
// by page.tsx, not by this card). Promotes the existing ScoreOrb radial gauge
// (used inside ScoreDrawer too) onto the dashboard hero row, with the three
// Quality/Trim/Risk chips inline and a "View full breakdown" CTA that opens
// the same ScoreDrawer on the Risk tab — the card highlights the highest-Risk
// holding, so the drawer should reinforce that signal.
//
// Top-3 signal contributors land on Day 8 alongside <SignalContributionsList>;
// for now the gauge + chips + drawer-link tells the story.

import { ScoreOrb } from "@/app/app/portfolio/_components/score-orb";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import { FlaggedDrawerButton } from "./FlaggedDrawerButton";

export interface FlaggedHoldingCardProps {
  flaggedTicker: string | null;
  score: HoldingScore | null;
  isBeta: boolean;
}

function CardSurround({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      {children}
    </div>
  );
}

export function FlaggedHoldingCard({
  flaggedTicker,
  score,
  isBeta,
}: FlaggedHoldingCardProps) {
  if (!flaggedTicker || !score) {
    return (
      <CardSurround>
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Flagged holding
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Scores collecting. Check back overnight.
        </p>
      </CardSurround>
    );
  }

  return (
    <CardSurround>
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Highest-Risk holding
      </p>
      <div className="mt-3 flex-1">
        <ScoreOrb
          ticker={flaggedTicker}
          quality={score.buy}
          trim={score.trim}
          risk={score.risk}
          qualityGateReason={score.buyGateReason}
          size="md"
        />
      </div>
      <div className="mt-4 text-right">
        <FlaggedDrawerButton ticker={flaggedTicker} isBeta={isBeta} />
      </div>
    </CardSurround>
  );
}

import { ScoreOrb } from "@/app/app/portfolio/_components/score-orb";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import {
  SignalContributionRows,
  type SignalContributionRow,
} from "@/app/app/portfolio/[ticker]/_components/SignalContributionsList";
import { FlaggedDrawerButton } from "./FlaggedDrawerButton";

export interface FlaggedHoldingCardProps {
  flaggedTicker: string | null;
  score: HoldingScore | null;
  isBeta: boolean;
  topSignals?: ReadonlyArray<SignalContributionRow>;
}

function CardSurround({ children }: { children: React.ReactNode }) {
  return <div className="card-surface flex h-full flex-col">{children}</div>;
}

export function FlaggedHoldingCard({
  flaggedTicker,
  score,
  isBeta,
  topSignals,
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

  const signals = topSignals ?? [];

  return (
    <CardSurround>
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Highest-Risk holding
      </p>
      <div className="mt-3">
        <ScoreOrb
          ticker={flaggedTicker}
          quality={score.buy}
          trim={score.trim}
          risk={score.risk}
          qualityGateReason={score.buyGateReason}
          size="md"
        />
      </div>
      {signals.length > 0 && (
        <div className="mt-4 flex-1">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Top quality drags
          </p>
          <div className="mt-2">
            <SignalContributionRows signals={signals} compact />
          </div>
        </div>
      )}
      <div className="mt-4 text-right">
        <FlaggedDrawerButton ticker={flaggedTicker} isBeta={isBeta} />
      </div>
    </CardSurround>
  );
}

// Day 5: pure helper that picks the single holding the dashboard's flagged
// card should highlight. Rules per planning/plans/2026-06-14-app-shell-
// redesign-plan.md §pick-flagged: among holdings ∩ scored ∩ !DNQ, sort by
// highest Risk; tiebreak by lowest Quality (the `buy` score is labelled
// "Quality" in the chip UI). A score with `risk === null` OR `buy === null`
// is treated as DNQ — we can't sort by a missing risk and the tiebreak needs
// a Quality value, so excluding both keeps the rule total.

export interface FlaggableScore {
  ticker: string;
  buy: number | null;
  risk: number | null;
}

export interface FlaggableHolding {
  ticker: string;
}

export function pickFlaggedHolding(
  holdings: ReadonlyArray<FlaggableHolding>,
  scores: ReadonlyMap<string, FlaggableScore>,
): string | null {
  let bestTicker: string | null = null;
  let bestRisk = -Infinity;
  let bestQuality = Infinity;

  for (const h of holdings) {
    const s = scores.get(h.ticker);
    if (!s) continue;
    if (s.risk === null || s.buy === null) continue;

    if (
      s.risk > bestRisk ||
      (s.risk === bestRisk && s.buy < bestQuality)
    ) {
      bestRisk = s.risk;
      bestQuality = s.buy;
      bestTicker = h.ticker;
    }
  }

  return bestTicker;
}

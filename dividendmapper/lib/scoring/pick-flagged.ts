// Picks the single holding the dashboard's flagged card should highlight.
// Rule: among holdings ∩ scored where Risk is known, sort by highest Risk;
// tiebreak by lowest Quality (`buy`). A real Quality value beats a null one at
// the same Risk — a known-bad Quality is a stronger worst-case signal than
// unknown. When both candidates have null Quality, fall back to lower ticker
// alpha for determinism. Holdings whose Risk is null are skipped (no signal
// to flag on); the previous rule that also skipped null Quality silently hid
// the actual highest-risk tickers (UK / BDC scoring gaps) so it was dropped.

export interface FlaggableScore {
  ticker: string;
  buy: number | null;
  risk: number | null;
}

export interface FlaggableHolding {
  ticker: string;
}

function isWorse(
  candidate: FlaggableScore,
  candidateTicker: string,
  incumbentRisk: number,
  incumbentBuy: number | null,
  incumbentTicker: string,
): boolean {
  if (candidate.risk! > incumbentRisk) return true;
  if (candidate.risk! < incumbentRisk) return false;

  // Risk tied. Prefer the candidate with a real, lower Quality.
  if (candidate.buy !== null && incumbentBuy !== null) {
    if (candidate.buy < incumbentBuy) return true;
    if (candidate.buy > incumbentBuy) return false;
  } else if (candidate.buy !== null && incumbentBuy === null) {
    return true;
  } else if (candidate.buy === null && incumbentBuy !== null) {
    return false;
  }

  // Risk tied and Quality indistinguishable (both null or both equal).
  // Lower ticker alpha wins for determinism.
  return candidateTicker < incumbentTicker;
}

export function pickFlaggedHolding(
  holdings: ReadonlyArray<FlaggableHolding>,
  scores: ReadonlyMap<string, FlaggableScore>,
): string | null {
  let bestTicker: string | null = null;
  let bestRisk = -Infinity;
  let bestBuy: number | null = null;

  for (const h of holdings) {
    const s = scores.get(h.ticker);
    if (!s) continue;
    if (s.risk === null) continue;

    if (
      bestTicker === null ||
      isWorse(s, h.ticker, bestRisk, bestBuy, bestTicker)
    ) {
      bestRisk = s.risk;
      bestBuy = s.buy;
      bestTicker = h.ticker;
    }
  }

  return bestTicker;
}

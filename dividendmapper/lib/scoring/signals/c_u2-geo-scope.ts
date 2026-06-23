// C_U2 — UK REIT geographic scope from manual classification.
// Same JSON source as C_U1. Binary scoring:
//   uk_only         → 50 (single-country, FX-clean but no diversification)
//   overseas_exposed → 75 (geographic diversification, small FX risk overlay)
//
// Rationale: overseas exposure has historically been a net positive for UK
// REIT income resilience (continental European logistics in particular has
// outperformed UK retail through cycles), enough to outweigh the modest FX
// drag. Scoring overseas_exposed above uk_only is therefore deliberate.

import classification from "../data/uk-reit-classification.json";

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface CU2Inputs {
  geographicScope: string;
}

interface ClassificationEntry {
  geographicScope?: string;
}

export function geographicScopeFor(ticker: string): string | null {
  const entry = (classification as Record<string, ClassificationEntry | undefined>)[ticker];
  if (!entry || typeof entry.geographicScope !== "string") return null;
  return entry.geographicScope;
}

export function computeCU2GeoScope(inputs: CU2Inputs): SignalResult {
  switch (inputs.geographicScope) {
    case "uk_only":
      return { score: 50, humanLabel: "UK-only exposure" };
    case "overseas_exposed":
      return { score: 75, humanLabel: "diversified geographic exposure" };
    default:
      return { score: null, humanLabel: "geographic scope unavailable" };
  }
}

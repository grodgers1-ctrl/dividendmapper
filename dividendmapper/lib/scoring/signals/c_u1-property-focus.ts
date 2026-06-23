// C_U1 — UK REIT property concentration from manual classification.
// FMP's revenue-product-segmentation is empty for the LSE-listed REIT universe
// (probe-confirmed 2026-06-19), so we read the hand-classified JSON shipped
// in lib/scoring/data/uk-reit-classification.json.
//
// Scoring is intentionally binary: a diversified REIT scores high because it
// spans multiple property types; a single-sector REIT scores 50 because that
// concentration is usually a deliberate strategy choice (industrial focus,
// healthcare focus, etc.) rather than a defect.

import classification from "../data/uk-reit-classification.json";

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface CU1Inputs {
  propertyType: string;
}

interface ClassificationEntry {
  name?: string;
  propertyType?: string;
  geographicScope?: string;
  notes?: string;
  source?: string;
}

export function propertyTypeFor(ticker: string): string | null {
  const entry = (classification as Record<string, ClassificationEntry | undefined>)[ticker];
  if (!entry || typeof entry.propertyType !== "string") return null;
  return entry.propertyType;
}

export function computeCU1PropertyFocus(inputs: CU1Inputs): SignalResult {
  if (!inputs.propertyType) {
    return { score: null, humanLabel: "property type unavailable" };
  }
  if (inputs.propertyType === "diversified") {
    return { score: 100, humanLabel: "diversified property mix" };
  }
  return {
    score: 50,
    humanLabel: `${inputs.propertyType} focus (single sector)`,
  };
}

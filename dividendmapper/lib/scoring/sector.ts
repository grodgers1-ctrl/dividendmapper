// Internal sector enum used by quality gates + sector-aware signals (D1, R3).
// Mapped from FMP profile.industry; falls back to "other" when unmatched.
// REIT and Utility get distinct categories because quality gates apply
// different coverage thresholds (REITs use AFFO; Utilities tolerate 0.95
// vs the 1.1 default).

export type Sector =
  | "real_estate"
  | "utility"
  | "financial"
  | "energy"
  | "consumer_staples"
  | "consumer_discretionary"
  | "industrials"
  | "healthcare"
  | "technology"
  | "communication"
  | "basic_materials"
  | "other";

const PATTERNS: Array<[RegExp, Sector]> = [
  [/REIT|Real Estate/i, "real_estate"],
  [/Utilit/i, "utility"],
  [/Bank|Insurance|Capital Markets|Asset Management|Credit/i, "financial"],
  [/Oil|Gas|Coal|Energy/i, "energy"],
  [/Tobacco|Beverage|Household|Personal Products|Packaged Foods|Grocery Stores|Supermarket/i, "consumer_staples"],
  [/Retail|Apparel|Auto|Hotel|Restaurant|Leisure|Luxury|Discount Store|Department Store/i, "consumer_discretionary"],
  [/Aerospace|Defense|Machinery|Construction|Engineering|Industrial/i, "industrials"],
  [/Drug|Biotech|Medical|Healthcare|Pharma/i, "healthcare"],
  [/Software|Semiconductor|Computer|Internet|IT Services|Information Technology|Consumer Electronics/i, "technology"],
  [/Telecom|Media|Entertainment|Publishing/i, "communication"],
  [/Chemicals|Metals|Mining|Steel|Paper|Forest/i, "basic_materials"],
];

export function classifySector(industry: string | null): Sector {
  if (!industry) return "other";
  for (const [pattern, sector] of PATTERNS) {
    if (pattern.test(industry)) return sector;
  }
  return "other";
}

export const isRealEstate = (s: Sector): boolean => s === "real_estate";
export const isUtility = (s: Sector): boolean => s === "utility";
export const isFinancial = (s: Sector): boolean => s === "financial";

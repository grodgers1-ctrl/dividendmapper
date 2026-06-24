// Per-family display metadata. Read by the list page, per-ticker page, and the
// methodology page so all three surfaces stay in sync. Pure data — no I/O.

import type { VehicleType } from "../load-vehicle-score";

export type LeverageMode = "ffo-payout" | "nii-coverage" | "ltv";
export type SortDefault =
  | "resilience-desc"
  | "resilience-asc"
  | "alpha"
  | "yield-desc";

export interface VehicleFamily {
  vehicleType: VehicleType;
  slug: "reits" | "bdcs" | "uk-reits";
  heading: string;
  indexCopy: string;
  leverageMode: LeverageMode;
  sortDefault: SortDefault;
  methodologyAnchor: string;
}

export const VEHICLE_FAMILIES = {
  us_reit: {
    vehicleType: "us_reit",
    slug: "reits",
    heading: "US REITs",
    indexCopy:
      "Real estate investment trusts ranked by dividend resilience.",
    leverageMode: "ffo-payout",
    sortDefault: "resilience-desc",
    methodologyAnchor: "#us-reits",
  },
  us_bdc: {
    vehicleType: "us_bdc",
    slug: "bdcs",
    heading: "Business development companies (BDCs)",
    indexCopy:
      "High-yield US BDCs ranked by NII coverage strength and resilience.",
    leverageMode: "nii-coverage",
    sortDefault: "yield-desc",
    methodologyAnchor: "#us-bdcs",
  },
  uk_reit: {
    vehicleType: "uk_reit",
    slug: "uk-reits",
    heading: "UK REITs",
    indexCopy:
      "LSE-listed real estate investment trusts ranked by dividend resilience.",
    leverageMode: "ltv",
    sortDefault: "resilience-desc",
    methodologyAnchor: "#uk-reits",
  },
} as const satisfies Record<VehicleType, VehicleFamily>;

export const FAMILIES_BY_SLUG = {
  reits: VEHICLE_FAMILIES.us_reit,
  bdcs: VEHICLE_FAMILIES.us_bdc,
  "uk-reits": VEHICLE_FAMILIES.uk_reit,
} as const;

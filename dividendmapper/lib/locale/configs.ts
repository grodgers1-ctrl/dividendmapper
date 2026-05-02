import type { Locale, LocaleConfig } from "./types";

export type { Locale, LocaleConfig };

// All values verified against:
//   planning/research/uk-retirement-rules.md (UK 2026/27)
//   planning/research/us-retirement-rules.md (US 2026)
// Update those docs FIRST when refreshing for a new tax year.

export const UK_CONFIG: LocaleConfig = {
  locale: "uk",
  currency: "GBP",
  currencySymbol: "£",
  currencyCode: "GBP",
  dateFormat: "dd/MM/yyyy",
  taxYear: { label: "2026/27", start: "April 6", end: "April 5" },
  wrappers: {
    primary: ["ISA", "SIPP"],
    taxable: "GIA",
    primaryLimit: 20000, // ISA annual subscription cap (unchanged 2026/27)
    pensionLimit: 60000, // SIPP Annual Allowance (unchanged since April 2023)
    pensionLabel: "SIPP",
    taxFreeLabel: "ISA",
  },
  retirement: {
    accessAge: 55, // UK NMPA — rises to 57 from 6 April 2028 (Finance Act 2022)
    stateLabel: "State Pension",
    stateAge: 67, // 66 → 67 phasing through 2026/27; default to the higher end
    stateDefaultWeekly: 241.3, // Full new State Pension 2026/27
    stateDefaultMonthly: 1045.63, // 241.30 × 52 / 12
  },
  limits: {
    isaOrIra: 20000,
    sippOr401k: 60000,
    lumpSumAllowance: 268275, // UK LSA (post-LTA abolition, Finance Act 2024)
  },
  dividendTax: {
    allowance: 500,
    allowanceLabel: "Dividend Allowance",
  },
  riskFreeRate: 0.045,
};

export const US_CONFIG: LocaleConfig = {
  locale: "us",
  currency: "USD",
  currencySymbol: "$",
  currencyCode: "USD",
  dateFormat: "MM/dd/yyyy",
  taxYear: { label: "2026", start: "January 1", end: "December 31" },
  wrappers: {
    primary: ["401(k)", "IRA", "Roth IRA"],
    taxable: "Brokerage",
    primaryLimit: 7500, // IRA limit 2026 (Notice 2025-67)
    pensionLimit: 24500, // 401(k) deferral 2026 (Notice 2025-67)
    pensionLabel: "401(k)",
    taxFreeLabel: "IRA / Roth IRA",
  },
  retirement: {
    accessAge: 59.5,
    stateLabel: "Social Security",
    stateAge: 67, // FRA for those born 1960+
    stateDefaultWeekly: null,
    stateDefaultMonthly: 2071, // Average retired-worker benefit Jan 2026 (SSA)
  },
  limits: {
    isaOrIra: 7500,
    sippOr401k: 24500,
    lumpSumAllowance: null, // No direct US equivalent
  },
  dividendTax: {
    allowance: 0,
    allowanceLabel: "Qualified Dividend Rate",
  },
  riskFreeRate: 0.043,
};

export const CONFIGS: Record<Locale, LocaleConfig> = {
  uk: UK_CONFIG,
  us: US_CONFIG,
};

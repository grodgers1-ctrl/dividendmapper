import type { Locale, LocaleConfig } from "./types";

export type { Locale, LocaleConfig };

export const UK_CONFIG: LocaleConfig = {
  locale: "uk",
  currency: "GBP",
  currencySymbol: "£",
  currencyCode: "GBP",
  dateFormat: "dd/MM/yyyy",
  taxYear: { label: "2025/26", start: "April 6", end: "April 5" },
  wrappers: {
    primary: ["ISA", "SIPP"],
    taxable: "GIA",
    primaryLimit: 20000,
    pensionLimit: 60000,
    pensionLabel: "SIPP",
    taxFreeLabel: "ISA",
  },
  retirement: {
    accessAge: 57,
    stateLabel: "State Pension",
    stateAge: 67,
    stateDefaultMonthly: 959, // £221.20/wk × 52 / 12
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
  taxYear: { label: "2025", start: "January 1", end: "December 31" },
  wrappers: {
    primary: ["401(k)", "IRA", "Roth IRA"],
    taxable: "Brokerage",
    primaryLimit: 7000,
    pensionLimit: 23000,
    pensionLabel: "401(k)",
    taxFreeLabel: "IRA / Roth IRA",
  },
  retirement: {
    accessAge: 59.5,
    stateLabel: "Social Security",
    stateAge: 67,
    stateDefaultMonthly: 1800,
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

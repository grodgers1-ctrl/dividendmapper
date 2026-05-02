export type Locale = "uk" | "us";

export interface LocaleConfig {
  locale: Locale;
  currency: "GBP" | "USD";
  currencySymbol: "£" | "$";
  currencyCode: "GBP" | "USD";
  dateFormat: "dd/MM/yyyy" | "MM/dd/yyyy";
  taxYear: {
    label: string;
    start: string;
    end: string;
  };
  wrappers: {
    primary: string[];
    taxable: string;
    primaryLimit: number;
    pensionLimit: number;
    pensionLabel: string;
    taxFreeLabel: string;
  };
  retirement: {
    /** Earliest age at which private pension benefits can be accessed (UK NMPA 55 → 57 in 2028; US 59.5). */
    accessAge: number;
    /** Display label for the state-provided benefit ("State Pension" / "Social Security"). */
    stateLabel: string;
    /** Default age at which the state benefit can be claimed without reduction. */
    stateAge: number;
    /** Default monthly value of the state benefit, in local currency. */
    stateDefaultMonthly: number;
    /** Default weekly figure for State Pension; null for locales that don't quote weekly. */
    stateDefaultWeekly: number | null;
  };
  /** Wrapper-level limits used in inputs and tooltips. */
  limits: {
    /** Annual contribution cap on the primary tax-free wrapper (UK ISA / US IRA). */
    isaOrIra: number;
    /** Annual contribution cap on the primary tax-deferred wrapper (UK SIPP / US 401k). */
    sippOr401k: number;
    /** Lifetime cap on tax-free pension lump sums (UK LSA, £268,275). null for US. */
    lumpSumAllowance: number | null;
  };
  dividendTax: {
    allowance: number;
    allowanceLabel: string;
  };
  riskFreeRate: number;
}

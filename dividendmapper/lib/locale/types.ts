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
    accessAge: number;
    stateLabel: string;
    stateAge: number;
    stateDefaultMonthly: number;
  };
  dividendTax: {
    allowance: number;
    allowanceLabel: string;
  };
  riskFreeRate: number;
}

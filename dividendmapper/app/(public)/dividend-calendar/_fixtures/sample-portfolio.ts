// Locked sample portfolios for the public /dividend-calendar landing demo.
// Numbers are realistic-shaped to make the chart look alive, not actual market
// data. Any future tweak lives only in this file.

import type {
  IncomeCalendarExDiv,
  IncomeCalendarHolding,
  IncomeCalendarUserDividend,
  Locale,
} from "@/lib/portfolio/income-calendar";

export interface SamplePortfolio {
  locale: Locale;
  holdings: IncomeCalendarHolding[];
  userDividends: IncomeCalendarUserDividend[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToGbp: Record<string, number>;
}

const RATES_GBP = { GBP: 1, USD: 0.79, GBp: 0.01, GBX: 0.01 };
const RATES_USD = { USD: 1, GBP: 1 / 0.79, GBp: 0.01 / 0.79, GBX: 0.01 / 0.79 };

export const UK_SAMPLE: SamplePortfolio = {
  locale: "uk",
  ratesToGbp: RATES_GBP,
  holdings: [
    { ticker: "PHP.L",  quantity: 800, wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "BATS.L", quantity: 80,  wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "BBOX.L", quantity: 400, wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "IMB.L",  quantity: 60,  wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "SSE.L",  quantity: 100, wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "O",      quantity: 30,  wrapper: "gia", created_at: "2024-01-01" },
    { ticker: "ARCC",   quantity: 50,  wrapper: "gia", created_at: "2024-01-01" },
    { ticker: "SCHD",   quantity: 20,  wrapper: "gia", created_at: "2024-01-01" },
  ],
  userDividends: [
    { paid_on: "2025-12-29", amount: 4.20,  currency: "GBp", wrapper: "isa" },
    { paid_on: "2026-01-12", amount: 3.36,  currency: "GBp", wrapper: "isa" },
    { paid_on: "2026-01-22", amount: 7.95,  currency: "USD", wrapper: "gia" },
    { paid_on: "2026-02-09", amount: 4.68,  currency: "GBp", wrapper: "isa" },
    { paid_on: "2026-02-22", amount: 7.95,  currency: "USD", wrapper: "gia" },
    { paid_on: "2026-03-14", amount: 3.50,  currency: "GBp", wrapper: "isa" },
    { paid_on: "2026-03-22", amount: 7.95,  currency: "USD", wrapper: "gia" },
    { paid_on: "2026-04-09", amount: 3.36,  currency: "GBp", wrapper: "isa" },
    { paid_on: "2026-04-15", amount: 24.00, currency: "USD", wrapper: "gia" },
    { paid_on: "2026-04-22", amount: 7.95,  currency: "USD", wrapper: "gia" },
    { paid_on: "2026-05-06", amount: 4.68,  currency: "GBp", wrapper: "isa" },
    { paid_on: "2026-05-22", amount: 7.95,  currency: "USD", wrapper: "gia" },
  ],
  exDivByTicker: {
    "PHP.L":  { ex_date: "2026-07-02", pay_date: "2026-07-09", amount: 0.42,  currency: "GBp" },
    "BATS.L": { ex_date: "2026-07-09", pay_date: "2026-08-06", amount: 5.85,  currency: "GBp" },
    "BBOX.L": { ex_date: "2026-07-15", pay_date: "2026-08-19", amount: 0.20,  currency: "GBp" },
    "IMB.L":  { ex_date: "2026-08-20", pay_date: "2026-09-17", amount: 1.10,  currency: "GBp" },
    "SSE.L":  { ex_date: "2026-07-23", pay_date: "2026-09-18", amount: 0.30,  currency: "GBp" },
    "O":      { ex_date: "2026-07-11", pay_date: "2026-07-15", amount: 0.265, currency: "USD" },
    "ARCC":   { ex_date: "2026-09-15", pay_date: "2026-10-15", amount: 0.48,  currency: "USD" },
    "SCHD":   { ex_date: "2026-09-25", pay_date: "2026-09-30", amount: 0.78,  currency: "USD" },
  },
};

export const US_SAMPLE: SamplePortfolio = {
  locale: "us",
  ratesToGbp: RATES_USD,
  holdings: [
    { ticker: "O",    quantity: 30, wrapper: "roth_ira", created_at: "2024-01-01" },
    { ticker: "VICI", quantity: 50, wrapper: "roth_ira", created_at: "2024-01-01" },
    { ticker: "AMT",  quantity: 10, wrapper: "roth_ira", created_at: "2024-01-01" },
    { ticker: "ARCC", quantity: 80, wrapper: "ira",      created_at: "2024-01-01" },
    { ticker: "SCHD", quantity: 30, wrapper: "ira",      created_at: "2024-01-01" },
    { ticker: "BTI",  quantity: 40, wrapper: "brokerage", created_at: "2024-01-01" },
    { ticker: "AAPL", quantity: 20, wrapper: "brokerage", created_at: "2024-01-01" },
    { ticker: "MSFT", quantity: 15, wrapper: "brokerage", created_at: "2024-01-01" },
  ],
  userDividends: [
    { paid_on: "2025-12-15", amount: 13.50, currency: "USD", wrapper: "roth_ira" },
    { paid_on: "2026-01-15", amount: 7.95,  currency: "USD", wrapper: "roth_ira" },
    { paid_on: "2026-01-15", amount: 38.40, currency: "USD", wrapper: "ira" },
    { paid_on: "2026-02-13", amount: 22.40, currency: "USD", wrapper: "brokerage" },
    { paid_on: "2026-02-15", amount: 7.95,  currency: "USD", wrapper: "roth_ira" },
    { paid_on: "2026-03-15", amount: 4.80,  currency: "USD", wrapper: "brokerage" },
    { paid_on: "2026-03-15", amount: 7.95,  currency: "USD", wrapper: "roth_ira" },
    { paid_on: "2026-04-15", amount: 38.40, currency: "USD", wrapper: "ira" },
    { paid_on: "2026-04-15", amount: 7.95,  currency: "USD", wrapper: "roth_ira" },
    { paid_on: "2026-04-22", amount: 23.40, currency: "USD", wrapper: "ira" },
    { paid_on: "2026-05-15", amount: 11.25, currency: "USD", wrapper: "brokerage" },
    { paid_on: "2026-05-15", amount: 7.95,  currency: "USD", wrapper: "roth_ira" },
    { paid_on: "2026-05-21", amount: 16.50, currency: "USD", wrapper: "roth_ira" },
  ],
  exDivByTicker: {
    "O":    { ex_date: "2026-07-01", pay_date: "2026-07-15", amount: 0.265, currency: "USD" },
    "VICI": { ex_date: "2026-09-15", pay_date: "2026-10-06", amount: 0.27,  currency: "USD" },
    "AMT":  { ex_date: "2026-07-08", pay_date: "2026-07-22", amount: 1.65,  currency: "USD" },
    "ARCC": { ex_date: "2026-09-15", pay_date: "2026-10-15", amount: 0.48,  currency: "USD" },
    "SCHD": { ex_date: "2026-09-25", pay_date: "2026-09-30", amount: 0.78,  currency: "USD" },
    "BTI":  { ex_date: "2026-08-13", pay_date: "2026-08-26", amount: 0.56,  currency: "USD" },
    "AAPL": { ex_date: "2026-08-08", pay_date: "2026-08-15", amount: 0.24,  currency: "USD" },
    "MSFT": { ex_date: "2026-08-21", pay_date: "2026-09-11", amount: 0.75,  currency: "USD" },
  },
};

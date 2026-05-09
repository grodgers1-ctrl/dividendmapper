import type { LocaleConfig } from "@/lib/locale/types";

export interface ResolvedCurrency {
  /** ISO 4217 currency code, e.g. "USD". */
  code: string;
  /** Display symbol — Intl-derived to support arbitrary currencies. */
  symbol: string;
  /** Intl locale string for thousands/decimal separators. */
  intlLocale: string;
  /** Whether the resolved currency was overridden from a ticker fetch. */
  overridden: boolean;
}

const SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "CA$",
  CHF: "CHF",
  JPY: "¥",
  HKD: "HK$",
  AUD: "A$",
};

/**
 * Resolve the currency to use across the DCF UI.
 *
 * The locale toggle controls *tax/retirement* context (risk-free rate, ISA vs
 * 401(k) labels, etc.) — it does NOT change a stock's listed currency. So when
 * the user fetches TSLA in UK mode, the calculator stays in USD instead of
 * displaying $313 with a £ symbol.
 *
 * If no ticker has been fetched, fall back to the user's locale currency.
 */
export function resolveCurrency(
  override: string | null | undefined,
  config: LocaleConfig
): ResolvedCurrency {
  if (override && override !== config.currencyCode) {
    return {
      code: override,
      symbol: SYMBOLS[override] ?? override,
      intlLocale: intlLocaleForCurrency(override),
      overridden: true,
    };
  }
  return {
    code: config.currencyCode,
    symbol: config.currencySymbol,
    intlLocale: config.locale === "uk" ? "en-GB" : "en-US",
    overridden: false,
  };
}

function intlLocaleForCurrency(code: string): string {
  switch (code) {
    case "GBP":
      return "en-GB";
    case "EUR":
      return "en-IE";
    case "JPY":
      return "ja-JP";
    case "CAD":
      return "en-CA";
    case "AUD":
      return "en-AU";
    default:
      return "en-US";
  }
}

/** Format a per-share value with currency-appropriate decimals. */
export function formatShareCurrency(
  value: number,
  currency: ResolvedCurrency,
  options?: { compact?: boolean }
): string {
  if (options?.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat(currency.intlLocale, {
      style: "currency",
      currency: currency.code,
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat(currency.intlLocale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

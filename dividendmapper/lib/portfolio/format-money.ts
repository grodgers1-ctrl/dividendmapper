// Shared rounded-currency formatter (no "/yr" suffix). Framework-agnostic so
// both server pages and client table cells can use it. £/$/€ get a symbol
// prefix; anything else falls back to a trailing ISO code.

const CURRENCY_PREFIX: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function formatMoney(amount: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  const formatted = Math.round(amount).toLocaleString("en-GB");
  return prefix ? `${prefix}${formatted}` : `${formatted} ${currency}`;
}

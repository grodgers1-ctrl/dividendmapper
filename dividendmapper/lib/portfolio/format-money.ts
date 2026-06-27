// Shared rounded-currency formatter (no "/yr" suffix). Framework-agnostic so
// both server pages and client table cells can use it. £/$/€ get a symbol
// prefix; anything else falls back to a trailing ISO code.

const CURRENCY_PREFIX: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function formatMoney(
  amount: number,
  currency: string,
  opts?: { dp?: number },
): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  if (opts?.dp != null) {
    const formatted = amount.toLocaleString("en-GB", {
      minimumFractionDigits: opts.dp,
      maximumFractionDigits: opts.dp,
    });
    return prefix ? `${prefix}${formatted}` : `${formatted} ${currency}`;
  }
  const formatted = Math.round(amount).toLocaleString("en-GB");
  return prefix ? `${prefix}${formatted}` : `${formatted} ${currency}`;
}

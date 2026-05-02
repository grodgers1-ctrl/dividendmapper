import type { LocaleConfig } from "./types";

export const formatCurrency = (
  amount: number,
  config: LocaleConfig,
  compact = false
) => {
  if (compact) return formatCompactCurrency(amount, config);
  return new Intl.NumberFormat(config.locale === "uk" ? "en-GB" : "en-US", {
    style: "currency",
    currency: config.currencyCode,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Brand-consistent compact currency formatter. Avoids Intl.NumberFormat's
 * compact notation because Node and browser ICU disagree on the suffix case
 * (K vs k), causing SSR hydration mismatches. Always uppercase K/M/B.
 */
function formatCompactCurrency(amount: number, config: LocaleConfig): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const symbol = config.currencySymbol;

  if (abs >= 1e9) return `${sign}${symbol}${trimZero(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${trimZero(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${trimZero(abs / 1e3)}K`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

function trimZero(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export const formatPercent = (value: number, decimals = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;

export const formatNumber = (value: number, config?: LocaleConfig) =>
  new Intl.NumberFormat(
    config?.locale === "us" ? "en-US" : "en-GB"
  ).format(Math.round(value));

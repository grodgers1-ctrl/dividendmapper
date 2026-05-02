import type { LocaleConfig } from "./types";

export const formatCurrency = (
  amount: number,
  config: LocaleConfig,
  compact = false
) =>
  new Intl.NumberFormat(config.locale === "uk" ? "en-GB" : "en-US", {
    style: "currency",
    currency: config.currencyCode,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(amount);

export const formatPercent = (value: number, decimals = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;

export const formatNumber = (value: number, config?: LocaleConfig) =>
  new Intl.NumberFormat(
    config?.locale === "us" ? "en-US" : "en-GB"
  ).format(Math.round(value));

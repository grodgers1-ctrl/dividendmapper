// FMP reports UK (`.L`) dividend amounts in pence (GBp); everything else in
// the issuer's native currency, which for our coverage is overwhelmingly USD.
// Used to convert the per-share `next_ex_div_amount` cached in equity_scores
// to a primary-currency figure. Do NOT use holdings.cost_currency here — UK
// brokers typically store cost in GBP while the underlying dividend is in
// pence, which inflates the forecast 100x.

export function inferExDivNativeCurrency(ticker: string): string {
  return ticker.toUpperCase().endsWith(".L") ? "GBp" : "USD";
}

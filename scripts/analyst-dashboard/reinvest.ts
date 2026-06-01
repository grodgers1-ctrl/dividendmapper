// Reinvest allocator — Phase 2.75 Day 6B heuristic. Takes Buy scores as a
// Quality proxy and biases allocation toward high-Quality names while
// penalising concentration (so a single 90-score doesn't sink the whole pot).
//
// Formula per ticker:
//   raw   = max(0, buy - 50)            // anything <50 gets zero allocation
//   share = raw / sum(raw)
//   alloc = cash * share
// Sub-50 tickers and those failing the quality gate (buy === null) get 0.

export interface ReinvestRow {
  ticker: string;
  buy: number | null;
  share: number;
  allocation: number;
}

export function allocateReinvest(
  cash: number,
  scores: { ticker: string; buy: number | null }[],
): ReinvestRow[] {
  const positive = scores.map((s) => ({
    ticker: s.ticker,
    buy: s.buy,
    raw: s.buy != null ? Math.max(0, s.buy - 50) : 0,
  }));
  const total = positive.reduce((a, p) => a + p.raw, 0);
  if (total === 0 || cash <= 0) {
    return scores.map((s) => ({
      ticker: s.ticker,
      buy: s.buy,
      share: 0,
      allocation: 0,
    }));
  }
  return positive
    .map((p) => {
      const share = p.raw / total;
      return {
        ticker: p.ticker,
        buy: p.buy,
        share,
        allocation: Math.round(cash * share * 100) / 100,
      };
    })
    .sort((a, b) => b.allocation - a.allocation);
}

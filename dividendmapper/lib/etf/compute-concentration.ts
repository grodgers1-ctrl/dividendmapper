// dividendmapper/lib/etf/compute-concentration.ts

export interface ConcentrationInput {
  ticker: string;
  positionValue: number;
  holdings: Array<{
    holding_symbol: string;
    weight_pct: number;
    holding_name?: string | null;
  }>;
}

export interface ConcentrationRow {
  holding_symbol: string;
  name: string | null;
  value: number;
  viaCount: number;
  viaTickers: string[];
}

/**
 * Aggregate depth-1 underlying holdings across multiple owned ETFs.
 *
 * For each (etf, underlying) pair the contribution is `positionValue * (weight_pct / 100)`.
 * Returns rows sorted by total value descending.
 *
 * Note: positionValue must be normalised to a single currency before calling.
 * Mixing GBP and USD positions in one input array produces a number that has
 * no meaningful currency; callers should pre-convert or partition first.
 */
export function computeConcentration(etfs: ConcentrationInput[]): ConcentrationRow[] {
  const m = new Map<string, ConcentrationRow>();
  for (const e of etfs) {
    for (const h of e.holdings) {
      const contribution = e.positionValue * (h.weight_pct / 100);
      const existing = m.get(h.holding_symbol);
      if (existing) {
        existing.value += contribution;
        existing.viaCount += 1;
        existing.viaTickers.push(e.ticker);
        // Prefer the first non-null name we see.
        if (existing.name === null && h.holding_name) {
          existing.name = h.holding_name;
        }
      } else {
        m.set(h.holding_symbol, {
          holding_symbol: h.holding_symbol,
          name: h.holding_name ?? null,
          value: contribution,
          viaCount: 1,
          viaTickers: [e.ticker],
        });
      }
    }
  }
  return Array.from(m.values()).sort((a, b) => b.value - a.value);
}

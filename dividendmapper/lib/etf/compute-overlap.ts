export interface OverlapRow {
  holding_symbol: string;
  weight_pct: number;
}

export interface OverlapResult {
  sharedCount: number;
  sharedWeightA: number;
  sharedWeightB: number;
  onlyAWeight: number;
  onlyBWeight: number;
  shared: Array<{ holding_symbol: string; a: number; b: number }>;
  onlyA: OverlapRow[];
  onlyB: OverlapRow[];
}

export function computeOverlap(a: OverlapRow[], b: OverlapRow[]): OverlapResult {
  const ma = new Map(a.map((r) => [r.holding_symbol, r.weight_pct]));
  const mb = new Map(b.map((r) => [r.holding_symbol, r.weight_pct]));
  const shared: OverlapResult["shared"] = [];
  for (const [sym, wa] of ma) {
    if (mb.has(sym)) {
      shared.push({ holding_symbol: sym, a: wa, b: mb.get(sym)! });
    }
  }
  const sharedSyms = new Set(shared.map((s) => s.holding_symbol));
  const onlyA = a.filter((r) => !sharedSyms.has(r.holding_symbol));
  const onlyB = b.filter((r) => !sharedSyms.has(r.holding_symbol));
  return {
    sharedCount: shared.length,
    sharedWeightA: shared.reduce((s, x) => s + x.a, 0),
    sharedWeightB: shared.reduce((s, x) => s + x.b, 0),
    onlyAWeight: onlyA.reduce((s, x) => s + x.weight_pct, 0),
    onlyBWeight: onlyB.reduce((s, x) => s + x.weight_pct, 0),
    shared,
    onlyA,
    onlyB,
  };
}

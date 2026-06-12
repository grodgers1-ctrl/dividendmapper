// Pure selection logic for watchlist alerts: the watched tickers to score for a
// user, excluding the ones they already hold (a held+watched ticker already
// alerts via the holdings digest, so don't double-report it). De-duplicated,
// order-preserving.

export function watchedNotHeld(watched: string[], held: string[]): string[] {
  const heldSet = new Set(held);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of watched) {
    if (heldSet.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

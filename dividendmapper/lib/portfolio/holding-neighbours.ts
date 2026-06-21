// Pure helper for the HoldingPagerNav (Day 7). Given the user's holding
// tickers and the one currently rendered, returns the previous/next tickers
// for alpha-sorted prev/next navigation. Wraps at the ends so the pager
// always has somewhere to go when the user holds 2+. Returns null when the
// ticker isn't owned at all (page should 404 before calling this anyway).

export interface HoldingNeighbours {
  prev: string | null;
  next: string | null;
  /** 1-indexed position of `current` in the alpha-sorted unique set. */
  position: number;
  total: number;
}

export function holdingNeighbours(
  tickers: ReadonlyArray<string>,
  current: string,
): HoldingNeighbours | null {
  const unique = Array.from(new Set(tickers)).sort();
  const idx = unique.indexOf(current);
  if (idx === -1) return null;
  const total = unique.length;
  if (total === 1) {
    return { prev: null, next: null, position: 1, total: 1 };
  }
  const prev = unique[(idx - 1 + total) % total];
  const next = unique[(idx + 1) % total];
  return { prev, next, position: idx + 1, total };
}

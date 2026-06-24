// Shared modal-aggregation helper. Extracted from vehicle-assemble-inputs.ts
// in the CAL-3 fix so both the BDC special-distribution filter and the Q_S1
// streak signal can call it.
//
// The modal (most common) amount in a year is robust to FMP quirks like a
// stray 13th payment that inflates the raw sum: 13 monthly payments still
// have a single modal $-amount because 12 of them are the canonical rate.
// Comparing modal amounts year-over-year therefore picks up genuine per-
// payment cuts while ignoring stray-payment noise.

export function modalAmount(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  const counts = new Map<string, number>();
  for (const a of amounts) {
    const key = a.toFixed(4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let modeKey = "";
  let modeCount = 0;
  for (const [k, c] of counts) {
    if (c > modeCount) {
      modeCount = c;
      modeKey = k;
    }
  }
  return parseFloat(modeKey);
}

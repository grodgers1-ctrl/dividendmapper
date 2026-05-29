// Robust dividend-cut detection shared by GATE_2 (quality gate) and R1 (risk).
//
// A "cut" is a year-over-year decline in the TRAILING-12-MONTH dividend, using
// SPLIT-ADJUSTED dividends. Comparing annual totals (not individual payments)
// avoids false positives from:
//   • semi-annual payers whose small interim follows a large final (e.g. LGEN),
//   • frequency changes,
//   • normal quarterly variation (e.g. distribution ETFs).
// Using adjDividend avoids false cuts from stock splits.
//
// KNOWN LIMITATION (special dividends): a one-off special inflates one TTM
// window, so the following normal year can read as a >threshold "drop". Rare for
// our cohort; tracked as a Phase 3 refinement (detect & exclude non-recurring
// specials). See planning/07-phase2.75-and-3-synopsis.md.

export interface DividendPayment {
  date: string; // ISO ex-date
  adjDividend: number;
  dividend: number;
}

export interface DividendCutResult {
  isCut: boolean;
  cutDate: string | null;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const CUT_THRESHOLD = 0.9; // current TTM below 90% of prior-year TTM = a cut

function ttmSum(divs: DividendPayment[], endMs: number): number {
  const startMs = endMs - YEAR_MS;
  let total = 0;
  for (const d of divs) {
    const t = new Date(d.date).getTime();
    if (t > startMs && t <= endMs && Number.isFinite(d.adjDividend)) total += d.adjDividend;
  }
  return total;
}

export function detectDividendCut(
  divs: DividendPayment[],
  opts: { asOf?: Date; lookbackYears?: number } = {},
): DividendCutResult {
  const asOfMs = (opts.asOf ?? new Date()).getTime();
  const lookbackYears = opts.lookbackYears ?? 5;

  for (let k = 0; k < lookbackYears; k++) {
    const curEnd = asOfMs - k * YEAR_MS;
    const cur = ttmSum(divs, curEnd);
    const prev = ttmSum(divs, curEnd - YEAR_MS);
    if (prev > 0 && cur < prev * CUT_THRESHOLD) {
      // Cut date = the most recent payment inside the (reduced) current window.
      const inWindow = divs
        .filter((d) => {
          const t = new Date(d.date).getTime();
          return t > curEnd - YEAR_MS && t <= curEnd;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { isCut: true, cutDate: inWindow[0]?.date ?? null };
    }
  }
  return { isCut: false, cutDate: null };
}

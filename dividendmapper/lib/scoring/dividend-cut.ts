// Robust dividend-cut detection shared by GATE_2 (quality gate) and R1 (risk).
//
// A "cut" is a year-over-year decline in a dividend PAYMENT versus its
// counterpart one year earlier, using SPLIT-ADJUSTED amounts. We match each
// prior-year payment to the payment closest to one year later (within a
// tolerance) and compare the two amounts. A missing counterpart (the company
// paid last year but not this year) reads as a cut to zero. This per-payment
// matching is immune to:
//   • semi-annual payers whose small interim follows a large final (e.g. LGEN) —
//     interim matches interim, final matches final;
//   • the rolling-window clipping that the old trailing-TTM-sum approach hit,
//     where a 365-day window landed on a payment's exact boundary and counted
//     3 payments in one window vs 5 in the next, manufacturing a phantom "cut"
//     for strictly-increasing payers (PEP regression);
//   • one-off special dividends — a special has no same-slot counterpart, and the
//     following regular payment matches the prior regular payment, not the special.
// Using adjDividend avoids false cuts from stock splits.

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
const CUT_THRESHOLD = 0.9; // a payment below 90% of its year-ago counterpart = a cut
// Half a quarter: wide enough to absorb normal ex-date drift, narrow enough that
// a payment never matches the adjacent quarter (~91 days away).
const MATCH_TOLERANCE_MS = 60 * 24 * 60 * 60 * 1000;

interface Dated extends DividendPayment {
  t: number;
}

export function detectDividendCut(
  divs: DividendPayment[],
  opts: { asOf?: Date; lookbackYears?: number } = {},
): DividendCutResult {
  const asOfMs = (opts.asOf ?? new Date()).getTime();
  const lookbackYears = opts.lookbackYears ?? 5;

  // Newest-first, numeric timestamps, finite amounts only.
  const sorted: Dated[] = divs
    .filter((d) => Number.isFinite(d.adjDividend))
    .map((d) => ({ ...d, t: new Date(d.date).getTime() }))
    .sort((a, b) => b.t - a.t);

  // Slide a one-year "prior" window back across each lookback year. For every
  // prior-year payment, find its counterpart ~1 year later and compare amounts.
  for (let k = 0; k < lookbackYears; k++) {
    const curEnd = asOfMs - k * YEAR_MS;
    const curStart = curEnd - YEAR_MS;
    const prevStart = curEnd - 2 * YEAR_MS;
    const prior = sorted.filter((d) => d.t > prevStart && d.t <= curStart);

    for (const q of prior) {
      const expected = q.t + YEAR_MS;
      // The counterpart isn't due yet — don't penalise a not-yet-paid period.
      if (expected > asOfMs) continue;

      let match: Dated | null = null;
      let bestDiff = Infinity;
      for (const c of sorted) {
        if (c === q) continue;
        const diff = Math.abs(c.t - expected);
        if (diff <= MATCH_TOLERANCE_MS && diff < bestDiff) {
          bestDiff = diff;
          match = c;
        }
      }

      const curAmount = match ? match.adjDividend : 0;
      if (q.adjDividend > 0 && curAmount < q.adjDividend * CUT_THRESHOLD) {
        return {
          isCut: true,
          cutDate: match ? match.date : new Date(expected).toISOString().slice(0, 10),
        };
      }
    }
  }
  return { isCut: false, cutDate: null };
}

// Trim category A — valuation, inverted relative to Buy A. A stock that looks
// expensive on the Buy side (low yield vs range, high P/E, price above DCF) is a
// Trim candidate, so each Trim A signal is the sign-inverse of its Buy A sibling.

import type { SignalResult } from "./a1-yield-percentile";
import { computeA1YieldPercentile, type A1Inputs } from "./a1-yield-percentile";
import { computeA2PeVsHistory, type A2Inputs } from "./a2-pe-vs-history";
import { computeA3DcfGap, type A3Inputs, type A3Result } from "./a3-dcf-gap";

function invertScore(r: SignalResult): SignalResult {
  if (r.score == null) return r;
  return { score: 100 - r.score, humanLabel: r.humanLabel };
}

export function computeTrimA1(inputs: A1Inputs): SignalResult {
  const buy = computeA1YieldPercentile(inputs);
  const inv = invertScore(buy);
  if (inv.score == null) return inv;
  return { score: inv.score, humanLabel: `Yield below 5yr median (Trim ${inv.score})` };
}

export function computeTrimA2(inputs: A2Inputs): SignalResult {
  const buy = computeA2PeVsHistory(inputs);
  const inv = invertScore(buy);
  if (inv.score == null) return inv;
  return { score: inv.score, humanLabel: `Forward P/E above 5y avg` };
}

export function computeTrimA3(inputs: A3Inputs): A3Result {
  const buy = computeA3DcfGap(inputs);
  if (buy.score == null) return buy;
  return { score: 100 - buy.score, humanLabel: `DCF intrinsic below price`, softSignal: buy.softSignal };
}

// Buy A1 — Today's yield ranked within the 5-year daily yield distribution.
// High percentile = high yield = "cheap" = bullish for income holdings.
// Input is a precomputed daily yield series (caller derives from price + dividend
// history); we don't fetch FMP here — that's the orchestrator's job.

export interface A1Inputs {
  todayYield: number;          // decimal, e.g. 0.04 for 4%
  dailyYields: number[];       // historical daily yields, decimal
}

export interface SignalResult {
  score: number | null;        // 0-100, null = N/A
  humanLabel: string;
}

const MIN_HISTORY_DAYS = 250;

export function computeA1YieldPercentile(inputs: A1Inputs): SignalResult {
  if (inputs.dailyYields.length < MIN_HISTORY_DAYS) {
    return {
      score: null,
      humanLabel: "Insufficient yield history (need 250+ daily observations)",
    };
  }
  const sorted = [...inputs.dailyYields].sort((a, b) => a - b);
  let belowCount = 0;
  for (const v of sorted) {
    if (v < inputs.todayYield) belowCount++;
    else break;
  }
  const pct = Math.round((belowCount / sorted.length) * 100);
  const score = Math.max(0, Math.min(100, pct));
  const yieldPctLabel = `${(inputs.todayYield * 100).toFixed(2)}%`;
  return {
    score,
    humanLabel: `Yield ${yieldPctLabel} in ${score}th percentile of 5yr range`,
  };
}

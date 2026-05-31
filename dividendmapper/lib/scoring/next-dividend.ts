import type { FmpCalendarDividend } from "./fmp-client";

// The market-wide dividends-calendar contains every ticker's upcoming ex-div
// dates. Find this ticker's soonest one on or after `todayIso`. ISO date strings
// (YYYY-MM-DD) sort lexicographically, so plain string compare is correct.
export function nextUpcomingDividend(
  calendar: ReadonlyArray<FmpCalendarDividend>,
  ticker: string,
  todayIso: string,
): FmpCalendarDividend | null {
  let best: FmpCalendarDividend | null = null;
  for (const row of calendar) {
    if (row.symbol !== ticker) continue;
    if (row.date < todayIso) continue;
    if (best === null || row.date < best.date) best = row;
  }
  return best;
}

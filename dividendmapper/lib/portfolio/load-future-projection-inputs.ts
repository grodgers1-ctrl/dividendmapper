// Focused server-side loader for the /app/calendar future-projection card.
// Returns the per-ticker inputs the card needs that loadCalendarData doesn't
// already expose. Designed to run in Promise.all alongside loadCalendarData
// from app/app/calendar/page.tsx.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";

export interface ProjectionInputsData {
  /** equity_scores.projected_growth_rate per ticker (decimal CAGR, raw,
   * capped to ±20% by the scoring engine). The cap+fade to [0, +5%] is
   * applied client-side in projectFuture. Missing entries default to 0. */
  growthRateByTicker: Record<string, number>;
}

export async function loadFutureProjectionInputs(
  _userId: string,
  holdings: ReadonlyArray<HoldingRow>,
): Promise<ProjectionInputsData> {
  const tickers = [...new Set(holdings.map((h) => h.ticker))];
  if (tickers.length === 0) return { growthRateByTicker: {} };

  const supabase = await createSupabaseServerClient();
  // PostgREST 1000-row hard cap: chunk if needed. See [[feedback_postgrest_1000_row_cap]].
  const growthRateByTicker: Record<string, number> = {};
  const chunkSize = 500;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("equity_scores")
      .select("ticker, projected_growth_rate")
      .in("ticker", chunk)
      .returns<{ ticker: string; projected_growth_rate: number | null }[]>();
    for (const row of data ?? []) {
      if (
        typeof row.projected_growth_rate === "number" &&
        Number.isFinite(row.projected_growth_rate)
      ) {
        growthRateByTicker[row.ticker] = row.projected_growth_rate;
      }
    }
  }

  return { growthRateByTicker };
}

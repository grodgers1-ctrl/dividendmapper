import { createSupabaseServerClient } from "@/lib/supabase/server";
import { latestSignalsByTicker, type SignalRow } from "./buy-signals";
import type { StoredSignal } from "./reaggregate";

export async function loadBuySignals(
  tickers: string[],
): Promise<Record<string, StoredSignal[]>> {
  if (tickers.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("equity_score_signals")
    .select("ticker, signal_code, raw_score, weight, observed_at")
    .eq("score_type", "buy")
    .in("ticker", tickers)
    .returns<SignalRow[]>();
  return latestSignalsByTicker(data ?? []);
}

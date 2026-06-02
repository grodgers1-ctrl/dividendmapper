// Pure grouping for the personalisation lens: collapse equity_score_signals
// rows to the latest observed_at per ticker. No I/O (load-buy-signals.ts wraps
// the fetch) so it unit-tests without the server-only Supabase client.

import type { StoredSignal } from "./reaggregate";

export interface SignalRow {
  ticker: string;
  signal_code: string;
  raw_score: number | null;
  weight: number;
  observed_at: string;
}

export function latestSignalsByTicker(rows: SignalRow[]): Record<string, StoredSignal[]> {
  const newest: Record<string, string> = {};
  for (const r of rows) {
    if (!newest[r.ticker] || r.observed_at > newest[r.ticker]) newest[r.ticker] = r.observed_at;
  }
  const out: Record<string, StoredSignal[]> = {};
  for (const r of rows) {
    if (r.observed_at !== newest[r.ticker]) continue;
    (out[r.ticker] ??= []).push({
      signal_code: r.signal_code,
      raw_score: r.raw_score,
      weight: r.weight,
    });
  }
  return out;
}

// Phase 4 Sprint 1 Day 2 Task 2.2 — Supabase persistence helpers for the
// vehicle ingestion pipeline. Thin wrappers around supabase-js .upsert()
// with the onConflict keys that match migration 0018's unique constraints.

import type { VehiclePriceRow, VehicleFundamentalsRow } from "./vehicle-fmp";
import type { VehicleScoreResult } from "./compute-vehicle-score";

// Loose SupabaseClient surface — accepts any client with a .from(table).upsert(rows, opts)
// chain. Keeps the persistence module decoupled from the supabase-js version pin.
//
// upsert returns PromiseLike (not Promise): supabase-js's PostgrestFilterBuilder
// is thenable but lacks .catch / .finally / Symbol.toStringTag. We only need
// `await + destructure error`, which PromiseLike covers. Using Promise here
// breaks the prod build (caught 2026-06-23 — the test stub returns a real
// Promise, so vitest passes but `next build`'s strict tsc rejects).
interface UpsertChain {
  upsert(rows: unknown[], opts?: { onConflict?: string }): PromiseLike<{ error: unknown }>;
}
interface MinimalSupabaseClient {
  from(table: string): UpsertChain;
}

export async function upsertVehiclePrices(
  sb: MinimalSupabaseClient,
  rows: VehiclePriceRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await sb.from("vehicle_prices").upsert(rows, {
    onConflict: "ticker,observed_at",
  });
  if (error) throw error;
}

export async function upsertVehicleFundamentals(
  sb: MinimalSupabaseClient,
  rows: VehicleFundamentalsRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await sb.from("vehicle_fundamentals").upsert(rows, {
    onConflict: "ticker,period_end,period_type",
  });
  if (error) throw error;
}

// -------- Sprint 2 Day 11: scoring persistence --------

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertVehicleScore(
  sb: MinimalSupabaseClient,
  result: VehicleScoreResult,
): Promise<void> {
  const row = {
    ticker: result.ticker,
    vehicle_type: result.vehicleType,
    resilience_score: result.resilienceScore,
    quality_gate_passed: result.qualityGatePassed,
    failed_gates: result.failedGates,
    data_quality: result.dataQuality,
    computed_at: new Date().toISOString(),
  };
  const { error } = await sb.from("vehicle_scores").upsert([row], {
    onConflict: "ticker",
  });
  if (error) throw error;
}

export interface VehicleScoreSignalRow {
  ticker: string;
  signal_code: string;
  raw_score: number | null;
  weight: number;
  contribution: number;
  human_label: string;
  observed_at: string;
}

export async function appendVehicleScoreSignals(
  sb: MinimalSupabaseClient,
  result: VehicleScoreResult,
): Promise<void> {
  if (result.signals.length === 0) return;
  const observedAt = todayIsoUtc();
  const rows: VehicleScoreSignalRow[] = result.signals.map((s) => ({
    ticker: result.ticker,
    signal_code: s.code,
    raw_score: s.rawScore,
    weight: s.weight,
    contribution: s.contribution,
    human_label: s.humanLabel,
    observed_at: observedAt,
  }));
  const { error } = await sb.from("vehicle_score_signals").upsert(rows, {
    onConflict: "ticker,signal_code,observed_at",
  });
  if (error) throw error;
}

export interface VehicleScoreHistoryRow {
  ticker: string;
  observed_at: string;
  resilience_score: number | null;
  price_nav_ratio: number | null;
}

export async function appendVehicleScoreHistory(
  sb: MinimalSupabaseClient,
  result: VehicleScoreResult,
): Promise<void> {
  const row: VehicleScoreHistoryRow = {
    ticker: result.ticker,
    observed_at: todayIsoUtc(),
    resilience_score: result.resilienceScore,
    price_nav_ratio: result.priceNavRatio,
  };
  const { error } = await sb.from("vehicle_score_history").upsert([row], {
    onConflict: "ticker,observed_at",
  });
  if (error) throw error;
}

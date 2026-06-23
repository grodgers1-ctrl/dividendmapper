// Phase 4 Sprint 1 Day 2 Task 2.2 — Supabase persistence helpers for the
// vehicle ingestion pipeline. Thin wrappers around supabase-js .upsert()
// with the onConflict keys that match migration 0018's unique constraints.

import type { VehiclePriceRow, VehicleFundamentalsRow } from "./vehicle-fmp";

// Loose SupabaseClient surface — accepts any client with a .from(table).upsert(rows, opts)
// chain. Keeps the persistence module decoupled from the supabase-js version
// pin (existing fmp-client.ts uses the same loose typing approach).
interface UpsertChain {
  upsert(rows: unknown[], opts?: { onConflict?: string }): Promise<{ error: unknown }>;
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

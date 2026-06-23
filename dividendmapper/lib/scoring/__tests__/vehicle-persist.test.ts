import { describe, it, expect, vi } from "vitest";
import { upsertVehiclePrices, upsertVehicleFundamentals } from "../vehicle-persist";

// Minimal Supabase-shape stub — records the table name + upsert args so we
// can assert the onConflict key matches the unique constraint declared in
// migration 0018.
function stubSupabase() {
  const calls: Array<{ table: string; rows: unknown[]; onConflict: string | undefined }> = [];
  const upsert = vi.fn(async (rows: unknown[], opts?: { onConflict?: string }) => {
    calls[calls.length - 1].rows = rows;
    calls[calls.length - 1].onConflict = opts?.onConflict;
    return { error: null };
  });
  const from = vi.fn((table: string) => {
    calls.push({ table, rows: [], onConflict: undefined });
    return { upsert };
  });
  return { sb: { from } as any, calls };
}

describe("vehicle-persist / upsertVehiclePrices", () => {
  it("upserts rows into vehicle_prices with onConflict=ticker,observed_at", async () => {
    const { sb, calls } = stubSupabase();
    await upsertVehiclePrices(sb, [
      { ticker: "O", observed_at: "2026-06-20", close_price: 57.12 },
      { ticker: "O", observed_at: "2026-06-19", close_price: 56.84 },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("vehicle_prices");
    expect(calls[0].onConflict).toBe("ticker,observed_at");
    expect(calls[0].rows).toHaveLength(2);
  });

  it("returns early when rows is empty (no DB call)", async () => {
    const { sb, calls } = stubSupabase();
    await upsertVehiclePrices(sb, []);
    expect(calls).toHaveLength(0);
  });
});

describe("vehicle-persist / upsertVehicleFundamentals", () => {
  it("upserts rows into vehicle_fundamentals with the 3-col unique", async () => {
    const { sb, calls } = stubSupabase();
    await upsertVehicleFundamentals(sb, [
      {
        ticker: "O",
        period_end: "2026-03-31",
        period_type: "quarterly",
        ffo_per_share: null,
        affo_per_share: null,
        nii_per_share: null,
        nav_per_share: 43.68,
        debt_total: 27000000000,
        equity_total: 38000000000,
        ebitda: 1180000000,
        interest_expense: 230000000,
        ltv_pct: null,
      },
    ]);
    expect(calls[0].table).toBe("vehicle_fundamentals");
    expect(calls[0].onConflict).toBe("ticker,period_end,period_type");
  });

  it("returns early when rows is empty", async () => {
    const { sb, calls } = stubSupabase();
    await upsertVehicleFundamentals(sb, []);
    expect(calls).toHaveLength(0);
  });
});

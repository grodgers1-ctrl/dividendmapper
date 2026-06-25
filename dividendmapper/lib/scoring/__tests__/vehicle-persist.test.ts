import { describe, it, expect, vi } from "vitest";
import {
  upsertVehiclePrices,
  upsertVehicleFundamentals,
  upsertVehicleUniverseDisplay,
} from "../vehicle-persist";

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

describe("vehicle-persist / upsertVehicleUniverseDisplay", () => {
  // Regression — prior implementation used .upsert() which tried INSERT first
  // and failed NOT NULL on display_name/exchange/currency/vehicle_type before
  // the ON CONFLICT path ever fired. Fix: UPDATE only (rows always exist via
  // FK from vehicle_scores).
  it("updates vehicle_universe by ticker, NOT upsert (avoids NOT NULL violation)", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ update, upsert }));
    const sb = { from } as any;

    await upsertVehicleUniverseDisplay(sb, {
      ticker: "O",
      dividend_yield: 0.056,
      leverage_headline: "FFO payout 81%",
    });

    expect(from).toHaveBeenCalledWith("vehicle_universe");
    expect(update).toHaveBeenCalledWith({
      dividend_yield: 0.056,
      leverage_headline: "FFO payout 81%",
    });
    expect(eq).toHaveBeenCalledWith("ticker", "O");
    // Confirm we do NOT touch upsert — that would re-introduce the NOT NULL bug.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("propagates errors from the update", async () => {
    const eq = vi.fn(async () => ({ error: { message: "boom" } }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const sb = { from } as any;

    await expect(
      upsertVehicleUniverseDisplay(sb, {
        ticker: "X",
        dividend_yield: null,
        leverage_headline: null,
      }),
    ).rejects.toMatchObject({ message: "boom" });
  });
});

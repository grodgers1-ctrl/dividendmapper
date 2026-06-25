import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchFundamentalsMock = vi.fn();
vi.mock("@/lib/scoring/vehicle-fmp", () => ({
  fetchVehicleFundamentals: fetchFundamentalsMock,
}));

const upsertFundamentalsMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scoring/vehicle-persist", () => ({
  upsertVehicleFundamentals: upsertFundamentalsMock,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const universeResult: { data: Array<{ ticker: string; vehicle_type: string; currency: string }> | null; error: unknown } = {
  data: [
    { ticker: "O", vehicle_type: "us_reit", currency: "USD" },
    { ticker: "ARCC", vehicle_type: "us_bdc", currency: "USD" },
    { ticker: "BLND.L", vehicle_type: "uk_reit", currency: "GBX" },
  ],
  error: null,
};

function makeUniverseChain() {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void) => resolve(universeResult),
  };
  return chain;
}

const fromMock = vi.fn((table: string) => {
  if (table === "vehicle_universe") return makeUniverseChain();
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  fetchFundamentalsMock.mockReset();
  fetchFundamentalsMock.mockResolvedValue([
    { ticker: "_", period_end: "2026-03-31", period_type: "quarterly", nav_per_share: 10, debt_total: 1, equity_total: 1, ebitda: 1, interest_expense: 1, ffo_per_share: null, affo_per_share: null, nii_per_share: null, ltv_pct: null },
  ]);
});

describe("refresh-vehicle-fundamentals route", () => {
  it("401s without Bearer auth", async () => {
    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/internal/refresh-vehicle-fundamentals"));
    expect(res.status).toBe(401);
  });

  it("dispatches fetchVehicleFundamentals per (ticker, vehicleType, currency)", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request("http://localhost/api/internal/refresh-vehicle-fundamentals", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      tickerCount: 3,
      successfulTickerCount: 3,
      failedTickerCount: 0,
      fundamentalsRowsUpserted: 3,
    });
    expect(fetchFundamentalsMock).toHaveBeenCalledWith("O", "us_reit", "USD");
    expect(fetchFundamentalsMock).toHaveBeenCalledWith("ARCC", "us_bdc", "USD");
    expect(fetchFundamentalsMock).toHaveBeenCalledWith("BLND.L", "uk_reit", "GBX");
  });
});

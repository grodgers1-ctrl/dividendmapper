import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchPricesMock = vi.fn();
vi.mock("@/lib/scoring/vehicle-fmp", () => ({
  fetchVehiclePrices: fetchPricesMock,
}));

const upsertPricesMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scoring/vehicle-persist", () => ({
  upsertVehiclePrices: upsertPricesMock,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// vehicle_universe fixture used by the .from('vehicle_universe').select(...).eq(...).eq(...) chain.
let universeResult: { data: Array<{ ticker: string; currency: string }> | null; error: unknown } = {
  data: [
    { ticker: "O", currency: "USD" },
    { ticker: "ARCC", currency: "USD" },
    { ticker: "BLND.L", currency: "GBX" },
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
  universeResult = {
    data: [
      { ticker: "O", currency: "USD" },
      { ticker: "ARCC", currency: "USD" },
      { ticker: "BLND.L", currency: "GBX" },
    ],
    error: null,
  };
  fetchPricesMock.mockReset();
  fetchPricesMock.mockResolvedValue([
    { ticker: "_", observed_at: "2026-06-20", close_price: 1.0 },
    { ticker: "_", observed_at: "2026-06-19", close_price: 1.0 },
  ]);
});

describe("refresh-vehicle-prices route", () => {
  it("401s without Bearer auth", async () => {
    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/internal/refresh-vehicle-prices"));
    expect(res.status).toBe(401);
  });

  it("iterates universe, calls fetchVehiclePrices per ticker, returns summary", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request("http://localhost/api/internal/refresh-vehicle-prices", {
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
      priceRowsUpserted: 6,
    });
    expect(fetchPricesMock).toHaveBeenCalledTimes(3);
    expect(fetchPricesMock).toHaveBeenCalledWith("O", 5, "USD");
    expect(fetchPricesMock).toHaveBeenCalledWith("BLND.L", 5, "GBX");
  });

  it("survives per-ticker FMP failure (Sentry-captures, continues)", async () => {
    fetchPricesMock.mockRejectedValueOnce(new Error("FMP 500"));
    fetchPricesMock.mockResolvedValueOnce([{ ticker: "ARCC", observed_at: "2026-06-20", close_price: 22 }]);
    fetchPricesMock.mockResolvedValueOnce([{ ticker: "BLND.L", observed_at: "2026-06-20", close_price: 4.1 }]);
    const { GET } = await import("../route");
    const res = await GET(
      new Request("http://localhost/api/internal/refresh-vehicle-prices", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      tickerCount: 3,
      successfulTickerCount: 2,
      failedTickerCount: 1,
    });
  });
});

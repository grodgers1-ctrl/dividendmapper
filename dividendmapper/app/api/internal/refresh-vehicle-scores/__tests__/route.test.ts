import { describe, it, expect, beforeEach, vi } from "vitest";

const computeScoreMock = vi.fn();
vi.mock("@/lib/scoring/compute-vehicle-score", () => ({
  computeVehicleScore: computeScoreMock,
}));

const upsertScoreMock = vi.fn().mockResolvedValue(undefined);
const appendSignalsMock = vi.fn().mockResolvedValue(undefined);
const appendHistoryMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scoring/vehicle-persist", () => ({
  upsertVehicleScore: upsertScoreMock,
  appendVehicleScoreSignals: appendSignalsMock,
  appendVehicleScoreHistory: appendHistoryMock,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

let universeResult: {
  data: Array<{ ticker: string; vehicle_type: string }> | null;
  error: unknown;
} = {
  data: [
    { ticker: "O", vehicle_type: "us_reit" },
    { ticker: "ARCC", vehicle_type: "us_bdc" },
    { ticker: "BLND.L", vehicle_type: "uk_reit" },
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
      { ticker: "O", vehicle_type: "us_reit" },
      { ticker: "ARCC", vehicle_type: "us_bdc" },
      { ticker: "BLND.L", vehicle_type: "uk_reit" },
    ],
    error: null,
  };
  computeScoreMock.mockReset();
  computeScoreMock.mockResolvedValue({
    ticker: "_",
    vehicleType: "us_reit",
    resilienceScore: 72,
    qualityGatePassed: true,
    failedGates: [],
    signals: [],
    dataQuality: "full",
    priceNavRatio: 1.05,
  });
});

describe("refresh-vehicle-scores route", () => {
  it("401s without Bearer auth", async () => {
    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/internal/refresh-vehicle-scores"));
    expect(res.status).toBe(401);
  });

  it("iterates the universe and persists per-ticker via all three helpers", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request("http://localhost/api/internal/refresh-vehicle-scores", {
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
      scoredCount: 3,
      gateFailedCount: 0,
    });
    expect(computeScoreMock).toHaveBeenCalledTimes(3);
    expect(computeScoreMock).toHaveBeenCalledWith(expect.anything(), "O", "us_reit");
    expect(computeScoreMock).toHaveBeenCalledWith(expect.anything(), "ARCC", "us_bdc");
    expect(computeScoreMock).toHaveBeenCalledWith(expect.anything(), "BLND.L", "uk_reit");
    expect(upsertScoreMock).toHaveBeenCalledTimes(3);
    expect(appendSignalsMock).toHaveBeenCalledTimes(3);
    expect(appendHistoryMock).toHaveBeenCalledTimes(3);
  });

  it("counts gate-failed scores separately from successful", async () => {
    computeScoreMock.mockResolvedValueOnce({
      ticker: "O",
      vehicleType: "us_reit",
      resilienceScore: 72,
      qualityGatePassed: true,
      failedGates: [],
      signals: [],
      dataQuality: "full",
      priceNavRatio: 1.05,
    });
    computeScoreMock.mockResolvedValueOnce({
      ticker: "DISTRESSED",
      vehicleType: "us_bdc",
      resilienceScore: null,
      qualityGatePassed: false,
      failedGates: ["G_B1"],
      signals: [],
      dataQuality: "partial",
      priceNavRatio: 0.8,
    });
    computeScoreMock.mockResolvedValueOnce({
      ticker: "BLND.L",
      vehicleType: "uk_reit",
      resilienceScore: 60,
      qualityGatePassed: true,
      failedGates: [],
      signals: [],
      dataQuality: "full",
      priceNavRatio: 0.95,
    });

    const { GET } = await import("../route");
    const res = await GET(
      new Request("http://localhost/api/internal/refresh-vehicle-scores", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    const body = await res.json();
    expect(body.scoredCount).toBe(2);
    expect(body.gateFailedCount).toBe(1);
  });

  it("survives per-ticker score failure (Sentry-captures, continues)", async () => {
    computeScoreMock.mockRejectedValueOnce(new Error("FMP 500"));
    computeScoreMock.mockResolvedValue({
      ticker: "_",
      vehicleType: "us_reit",
      resilienceScore: 72,
      qualityGatePassed: true,
      failedGates: [],
      signals: [],
      dataQuality: "full",
      priceNavRatio: 1.05,
    });
    const { GET } = await import("../route");
    const res = await GET(
      new Request("http://localhost/api/internal/refresh-vehicle-scores", {
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

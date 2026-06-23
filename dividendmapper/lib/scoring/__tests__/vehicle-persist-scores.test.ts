import { describe, it, expect, vi } from "vitest";
import {
  upsertVehicleScore,
  appendVehicleScoreSignals,
  appendVehicleScoreHistory,
} from "../vehicle-persist";
import type { VehicleScoreResult } from "../compute-vehicle-score";

function buildResult(overrides: Partial<VehicleScoreResult> = {}): VehicleScoreResult {
  return {
    ticker: "O",
    vehicleType: "us_reit",
    resilienceScore: 72,
    qualityGatePassed: true,
    failedGates: [],
    signals: [
      { code: "Q_S1", rawScore: 75, weight: 0.1, contribution: 7.5, humanLabel: "10y streak" },
      { code: "Q_R1", rawScore: 100, weight: 0.1, contribution: 10, humanLabel: "FFO payout 65%" },
    ],
    dataQuality: "full",
    priceNavRatio: 1.08,
    ...overrides,
  };
}

function makeStubSb(upsertImpl?: () => Promise<{ error: unknown }>) {
  const upsertMock = vi.fn(
    upsertImpl ?? (() => Promise.resolve({ error: null })),
  );
  const fromMock = vi.fn(() => ({ upsert: upsertMock }));
  return { sb: { from: fromMock }, upsertMock, fromMock };
}

describe("upsertVehicleScore", () => {
  it("upserts a single vehicle_scores row keyed on ticker", async () => {
    const { sb, upsertMock, fromMock } = makeStubSb();
    await upsertVehicleScore(sb, buildResult());
    expect(fromMock).toHaveBeenCalledWith("vehicle_scores");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [rows, opts] = upsertMock.mock.calls[0];
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as Record<string, unknown>[])[0]).toMatchObject({
      ticker: "O",
      vehicle_type: "us_reit",
      resilience_score: 72,
      quality_gate_passed: true,
      failed_gates: [],
      data_quality: "full",
    });
    expect((opts as { onConflict: string }).onConflict).toBe("ticker");
  });

  it("propagates errors", async () => {
    const { sb } = makeStubSb(() => Promise.resolve({ error: new Error("boom") }));
    await expect(upsertVehicleScore(sb, buildResult())).rejects.toThrow("boom");
  });
});

describe("appendVehicleScoreSignals", () => {
  it("upserts one row per signal with correct conflict key", async () => {
    const { sb, upsertMock, fromMock } = makeStubSb();
    await appendVehicleScoreSignals(sb, buildResult());
    expect(fromMock).toHaveBeenCalledWith("vehicle_score_signals");
    const [rows, opts] = upsertMock.mock.calls[0];
    expect((rows as unknown[]).length).toBe(2);
    expect((opts as { onConflict: string }).onConflict).toBe(
      "ticker,signal_code,observed_at",
    );
    const first = (rows as Record<string, unknown>[])[0];
    expect(first).toMatchObject({
      ticker: "O",
      signal_code: "Q_S1",
      raw_score: 75,
      human_label: "10y streak",
    });
    expect(typeof first.observed_at).toBe("string");
  });

  it("no-ops on empty signals array", async () => {
    const { sb, upsertMock } = makeStubSb();
    await appendVehicleScoreSignals(sb, buildResult({ signals: [] }));
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("appendVehicleScoreHistory", () => {
  it("upserts one row with resilience_score and price_nav_ratio", async () => {
    const { sb, upsertMock, fromMock } = makeStubSb();
    await appendVehicleScoreHistory(sb, buildResult());
    expect(fromMock).toHaveBeenCalledWith("vehicle_score_history");
    const [rows, opts] = upsertMock.mock.calls[0];
    expect((opts as { onConflict: string }).onConflict).toBe("ticker,observed_at");
    const row = (rows as Record<string, unknown>[])[0];
    expect(row).toMatchObject({
      ticker: "O",
      resilience_score: 72,
      price_nav_ratio: 1.08,
    });
  });

  it("persists null score + null ratio when gate failed", async () => {
    const { sb, upsertMock } = makeStubSb();
    await appendVehicleScoreHistory(
      sb,
      buildResult({ resilienceScore: null, priceNavRatio: null, qualityGatePassed: false }),
    );
    const row = (upsertMock.mock.calls[0][0] as Record<string, unknown>[])[0];
    expect(row.resilience_score).toBeNull();
    expect(row.price_nav_ratio).toBeNull();
  });
});

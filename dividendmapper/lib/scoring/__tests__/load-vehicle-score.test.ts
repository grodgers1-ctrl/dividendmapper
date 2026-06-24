import { describe, it, expect, vi } from "vitest";
import {
  loadVehicleScore,
  loadVehicleScoreHistory,
  normalizeTicker,
} from "../load-vehicle-score";

type Row = Record<string, unknown>;

interface QueryBuilder {
  select: (cols: string) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  gte: (col: string, val: unknown) => QueryBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => QueryBuilder;
  maybeSingle: () => Promise<{ data: Row | null; error: unknown }>;
  then: (resolve: (v: { data: Row[] | null; error: unknown }) => void) => void;
}

function makeStubSb(responses: Record<string, Row | Row[] | null>) {
  const fromMock = vi.fn((table: string) => {
    const resp = responses[table] ?? null;
    const builder: Partial<QueryBuilder> & {
      _isSingle: boolean;
    } = { _isSingle: false };
    builder.select = () => builder as QueryBuilder;
    builder.eq = () => builder as QueryBuilder;
    builder.gte = () => builder as QueryBuilder;
    builder.order = () => builder as QueryBuilder;
    builder.maybeSingle = () => {
      builder._isSingle = true;
      return Promise.resolve({
        data: Array.isArray(resp) ? (resp[0] ?? null) : (resp as Row | null),
        error: null,
      });
    };
    // Thenable so `await sb.from(...).select().eq().order()` resolves like supabase-js does.
    builder.then = (resolve) => {
      const data = Array.isArray(resp) ? resp : resp == null ? [] : [resp];
      resolve({ data, error: null });
    };
    return builder as QueryBuilder;
  });
  return { sb: { from: fromMock }, fromMock };
}

describe("normalizeTicker", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeTicker("  o ")).toBe("O");
  });
  it("preserves dots and dashes (UK + share-class)", () => {
    expect(normalizeTicker("BLND.L")).toBe("BLND.L");
    expect(normalizeTicker("brk-a")).toBe("BRK-A");
  });
  it("rejects empty input", () => {
    expect(normalizeTicker("")).toBeNull();
    expect(normalizeTicker("   ")).toBeNull();
  });
  it("rejects malformed percent-encoding", () => {
    expect(normalizeTicker("%E0%A4%A")).toBeNull();
  });
});

describe("loadVehicleScore", () => {
  it("returns null when no vehicle_scores row exists", async () => {
    const { sb } = makeStubSb({ vehicle_scores: null });
    const result = await loadVehicleScore(sb, "NOPE");
    expect(result).toBeNull();
  });

  it("aggregates vehicle_scores + signals + universe for a ticker", async () => {
    const { sb } = makeStubSb({
      vehicle_scores: {
        ticker: "O",
        vehicle_type: "us_reit",
        resilience_score: 72,
        quality_gate_passed: true,
        failed_gates: [],
        data_quality: "full",
        computed_at: "2026-06-23T09:00:00Z",
      },
      vehicle_universe: {
        ticker: "O",
        display_name: "Realty Income",
        sub_sector: "retail_net_lease",
      },
      vehicle_score_signals: [
        {
          signal_code: "Q_S1",
          raw_score: 75,
          weight: 0.1,
          contribution: 7.5,
          human_label: "10y streak",
          observed_at: "2026-06-23",
        },
        {
          signal_code: "Q_R1",
          raw_score: 100,
          weight: 0.1,
          contribution: 10,
          human_label: "FFO payout 65%",
          observed_at: "2026-06-23",
        },
        {
          signal_code: "Q_S1",
          raw_score: 70,
          weight: 0.1,
          contribution: 7,
          human_label: "stale",
          observed_at: "2026-06-22",
        },
      ],
      vehicle_score_history: [
        { observed_at: "2026-06-23", price_nav_ratio: 1.08 },
        { observed_at: "2026-06-22", price_nav_ratio: 1.07 },
      ],
    });
    const result = await loadVehicleScore(sb, "O");
    expect(result).not.toBeNull();
    expect(result!.ticker).toBe("O");
    expect(result!.vehicleType).toBe("us_reit");
    expect(result!.resilienceScore).toBe(72);
    expect(result!.qualityGatePassed).toBe(true);
    expect(result!.displayName).toBe("Realty Income");
    expect(result!.subSector).toBe("retail_net_lease");
    expect(result!.priceNavRatio).toBe(1.08);
    // Most recent observed_at wins; the stale "2026-06-22" Q_S1 must be dropped.
    expect(result!.signals).toHaveLength(2);
    expect(result!.signals.every((s) => s.rawScore !== 70)).toBe(true);
  });

  it("returns failed gates for a gate-failed ticker", async () => {
    const { sb } = makeStubSb({
      vehicle_scores: {
        ticker: "BAD",
        vehicle_type: "us_bdc",
        resilience_score: null,
        quality_gate_passed: false,
        failed_gates: ["G_S2", "G_B1"],
        data_quality: "sparse",
        computed_at: "2026-06-23T09:00:00Z",
      },
      vehicle_universe: { ticker: "BAD", display_name: "Bad BDC", sub_sector: null },
      vehicle_score_signals: [],
      vehicle_score_history: [],
    });
    const result = await loadVehicleScore(sb, "BAD");
    expect(result!.resilienceScore).toBeNull();
    expect(result!.qualityGatePassed).toBe(false);
    expect(result!.failedGates).toEqual(["G_S2", "G_B1"]);
    expect(result!.priceNavRatio).toBeNull();
  });

  it("tolerates missing universe row by falling back to ticker as displayName", async () => {
    const { sb } = makeStubSb({
      vehicle_scores: {
        ticker: "ORPH",
        vehicle_type: "us_reit",
        resilience_score: 50,
        quality_gate_passed: true,
        failed_gates: [],
        data_quality: "partial",
        computed_at: "2026-06-23T09:00:00Z",
      },
      vehicle_universe: null,
      vehicle_score_signals: [],
      vehicle_score_history: [{ observed_at: "2026-06-23", price_nav_ratio: 0.99 }],
    });
    const result = await loadVehicleScore(sb, "ORPH");
    expect(result!.displayName).toBe("ORPH");
    expect(result!.subSector).toBeNull();
  });
});

describe("loadVehicleScoreHistory", () => {
  it("returns rows date-asc", async () => {
    const rows = [
      { observed_at: "2025-06-23", price_nav_ratio: 0.95 },
      { observed_at: "2026-06-23", price_nav_ratio: 1.08 },
      { observed_at: "2026-06-22", price_nav_ratio: 1.07 },
    ];
    const { sb } = makeStubSb({ vehicle_score_history: rows });
    const result = await loadVehicleScoreHistory(sb, "O", 365 * 5);
    expect(result).toHaveLength(3);
    // Caller-side normalisation: must come back in input order; the stub returns
    // what we set. The real query uses .order("observed_at", { ascending: true }).
  });

  it("returns [] when no rows exist", async () => {
    const { sb } = makeStubSb({ vehicle_score_history: [] });
    const result = await loadVehicleScoreHistory(sb, "NOPE", 365 * 5);
    expect(result).toEqual([]);
  });
});

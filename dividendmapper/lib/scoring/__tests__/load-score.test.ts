import { describe, it, expect, vi } from "vitest";
import { loadScore, normalizeTicker } from "../load-score";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("normalizeTicker", () => {
  it("uppercases and trims a valid ticker", () => {
    expect(normalizeTicker(" pep ")).toBe("PEP");
    expect(normalizeTicker("vod.l")).toBe("VOD.L");
  });

  it("decodes percent-encoding before validating", () => {
    expect(normalizeTicker("vod%2El")).toBe("VOD.L");
  });

  it("rejects path-traversal and illegal characters", () => {
    expect(normalizeTicker("../etc")).toBeNull();
    expect(normalizeTicker("AB CD")).toBeNull();
    expect(normalizeTicker("")).toBeNull();
  });

  it("rejects an over-long ticker", () => {
    expect(normalizeTicker("ABCDEFGHIJKLM")).toBeNull(); // 13 chars
  });

  it("returns null on malformed percent-encoding instead of throwing", () => {
    expect(normalizeTicker("%")).toBeNull();
  });
});

describe("loadScore", () => {
  function makeClient(scoreRow: Record<string, unknown> | null) {
    const scoreChain = {
      select: vi.fn(() => scoreChain),
      eq: vi.fn(() => scoreChain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: scoreRow, error: null })),
    };
    const signalsChain = {
      select: vi.fn(() => signalsChain),
      eq: vi.fn(() => signalsChain),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
    return {
      from: vi.fn((table: string) =>
        table === "equity_scores" ? scoreChain : signalsChain,
      ),
    } as unknown as SupabaseClient;
  }

  it("returns trailingPe alongside forwardPe from equity_scores", async () => {
    const client = makeClient({
      ticker: "AAPL",
      buy_score: 27,
      trim_score: 69,
      risk_score: 0,
      buy_quality_gate_passed: true,
      buy_failed_gates: [],
      data_quality: "full",
      computed_at: "2026-06-23T00:00:00Z",
      sector: "technology",
      forward_pe: 30.78,
      trailing_pe: 35.83,
      payout_ratio: 0.127,
      fcf_coverage: 8.31,
      dividend_cagr_5y: 0.047,
    });
    const result = await loadScore(client, "AAPL");
    expect(result?.forwardPe).toBe(30.78);
    expect(result?.trailingPe).toBe(35.83);
  });

  it("returns trailingPe as null when the column is null", async () => {
    const client = makeClient({
      ticker: "NEW",
      buy_score: null,
      trim_score: null,
      risk_score: null,
      buy_quality_gate_passed: false,
      buy_failed_gates: [],
      data_quality: "sparse",
      computed_at: "2026-06-23T00:00:00Z",
      sector: null,
      forward_pe: null,
      trailing_pe: null,
      payout_ratio: null,
      fcf_coverage: null,
      dividend_cagr_5y: null,
    });
    const result = await loadScore(client, "NEW");
    expect(result?.trailingPe).toBeNull();
  });
});

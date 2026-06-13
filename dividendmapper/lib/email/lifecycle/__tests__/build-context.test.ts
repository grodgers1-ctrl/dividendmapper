import { describe, it, expect } from "vitest";
import { buildLifecycleContext } from "../build-context";

interface State {
  holdings?: { ticker: string }[];
  scoreHistory?: Array<{ ticker: string; buy_score: number | null; observed_at: string }>;
  equityScores?: Array<{
    ticker: string;
    next_ex_div_date: string | null;
    next_ex_div_amount: number | null;
  }>;
}

// Chainable PostgREST-shaped builder where every method except the terminal
// thenable is a no-op. Each test provides the data per table; the chain
// returns it whatever filters were applied.
function makeSupabase(state: State) {
  return {
    from(table: string) {
      const data = (() => {
        if (table === "holdings") return state.holdings ?? [];
        if (table === "equity_score_history") return state.scoreHistory ?? [];
        if (table === "equity_scores") return state.equityScores ?? [];
        throw new Error("unexpected table " + table);
      })();
      const builder: Record<string, unknown> = { _data: data };
      const passthrough = ["select", "eq", "in", "order", "gte", "gt", "lt"];
      for (const m of passthrough) builder[m] = () => builder;
      builder.limit = (n: number) => {
        builder._data = (builder._data as unknown[]).slice(0, n);
        return builder;
      };
      builder.then = (cb: (r: { data: unknown; error: null }) => unknown) =>
        cb({ data: builder._data, error: null });
      return builder as unknown;
    },
  } as never;
}

const baseInput = {
  userId: "u1",
  tier: "free" as const,
  lifecycleUnsubscribed: false,
  lastSignInAt: "2026-06-12T10:00:00Z",
  nowMs: new Date("2026-06-13T10:00:00Z").getTime(),
};

describe("buildLifecycleContext (basics)", () => {
  it("returns 0 holdings and empty fields for an empty user", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({ holdings: [] }),
      { ...baseInput, lastSignInAt: "2026-06-01T10:00:00Z" },
    );
    expect(ctx.holdingsCount).toBe(0);
    expect(ctx.lowestScoringTicker).toBeNull();
    expect(ctx.proPitchLines).toEqual([]);
    expect(ctx.recentScoreMoves).toEqual([]);
    expect(ctx.upcomingExDivs).toEqual([]);
  });

  it("returns the count, lowest score, and pitch lines when holdings exist", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "MSFT" }, { ticker: "VOD.L" }],
        scoreHistory: [
          { ticker: "MSFT", buy_score: 78, observed_at: "2026-06-13" },
          { ticker: "VOD.L", buy_score: 22, observed_at: "2026-06-13" },
        ],
      }),
      baseInput,
    );
    expect(ctx.holdingsCount).toBe(2);
    expect(ctx.lowestScoringTicker).toEqual({ ticker: "VOD.L", score: 22 });
    expect(ctx.proPitchLines).toEqual(
      expect.arrayContaining([
        { ticker: "MSFT", action: "BUY", score: 78 },
        { ticker: "VOD.L", action: "TRIM", score: 22 },
      ]),
    );
  });
});

describe("buildLifecycleContext (pro pitch lines)", () => {
  it("maps score >= 70 to BUY, <= 30 to TRIM, in-between to HOLD", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "A" }, { ticker: "B" }, { ticker: "C" }],
        scoreHistory: [
          { ticker: "A", buy_score: 78, observed_at: "2026-06-13" },
          { ticker: "B", buy_score: 50, observed_at: "2026-06-13" },
          { ticker: "C", buy_score: 22, observed_at: "2026-06-13" },
        ],
      }),
      baseInput,
    );
    const byTicker = Object.fromEntries(
      ctx.proPitchLines.map((l) => [l.ticker, l.action]),
    );
    expect(byTicker).toEqual({ A: "BUY", B: "HOLD", C: "TRIM" });
  });

  it("ignores tickers with no score row", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "A" }, { ticker: "B" }],
        scoreHistory: [{ ticker: "A", buy_score: 78, observed_at: "2026-06-13" }],
      }),
      baseInput,
    );
    expect(ctx.proPitchLines.map((l) => l.ticker)).toEqual(["A"]);
  });
});

describe("buildLifecycleContext (score moves)", () => {
  // The mock returns the same scoreHistory array for both the "latest score"
  // query and the "history window" query. To assert the move logic we provide
  // a per-ticker chronologically ordered set where the from/to span >= 5 for
  // one ticker and < 5 for another.
  it("includes moves with |delta| >= 5 and excludes smaller ones", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "MOVER" }, { ticker: "STILL" }],
        scoreHistory: [
          // mover: 70 -> 78 = +8
          { ticker: "MOVER", buy_score: 70, observed_at: "2026-05-13" },
          { ticker: "MOVER", buy_score: 78, observed_at: "2026-06-13" },
          // still: 50 -> 52 = +2
          { ticker: "STILL", buy_score: 50, observed_at: "2026-05-13" },
          { ticker: "STILL", buy_score: 52, observed_at: "2026-06-13" },
        ],
      }),
      baseInput,
    );
    expect(ctx.recentScoreMoves).toEqual(
      expect.arrayContaining([{ ticker: "MOVER", from: 70, to: 78 }]),
    );
    expect(ctx.recentScoreMoves.find((m) => m.ticker === "STILL")).toBeUndefined();
  });

  it("returns no moves when a ticker has only one observation", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "SOLO" }],
        scoreHistory: [{ ticker: "SOLO", buy_score: 78, observed_at: "2026-06-13" }],
      }),
      baseInput,
    );
    expect(ctx.recentScoreMoves).toEqual([]);
  });
});

describe("buildLifecycleContext (upcoming ex-divs)", () => {
  it("returns ex-div rows with date + payment", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "VOD.L" }],
        scoreHistory: [{ ticker: "VOD.L", buy_score: 50, observed_at: "2026-06-13" }],
        equityScores: [
          { ticker: "VOD.L", next_ex_div_date: "2026-07-04", next_ex_div_amount: 10.5 },
        ],
      }),
      baseInput,
    );
    expect(ctx.upcomingExDivs).toEqual([
      { ticker: "VOD.L", exDate: "2026-07-04", payment: "10.5" },
    ]);
  });

  it("skips rows missing date or amount", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "X" }],
        scoreHistory: [{ ticker: "X", buy_score: 50, observed_at: "2026-06-13" }],
        equityScores: [
          { ticker: "X", next_ex_div_date: null, next_ex_div_amount: 10 },
          { ticker: "X", next_ex_div_date: "2026-07-01", next_ex_div_amount: null },
        ],
      }),
      baseInput,
    );
    expect(ctx.upcomingExDivs).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { buildLifecycleContext } from "../build-context";

function makeSupabase(state: {
  holdings: { ticker: string }[];
  scoresLowest?: { ticker: string; score: number } | null;
}) {
  return {
    from(table: string) {
      if (table === "holdings") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: state.holdings, error: null }),
          }),
        };
      }
      if (table === "equity_score_history") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: state.scoresLowest
                      ? [{ ticker: state.scoresLowest.ticker, buy_score: state.scoresLowest.score }]
                      : [],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    },
  } as never;
}

describe("buildLifecycleContext", () => {
  it("returns 0 holdings, null lowest score for an empty user", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({ holdings: [] }),
      {
        userId: "u1",
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAt: "2026-06-01T10:00:00Z",
        nowMs: new Date("2026-06-13T10:00:00Z").getTime(),
      },
    );
    expect(ctx.holdingsCount).toBe(0);
    expect(ctx.lowestScoringTicker).toBeNull();
  });

  it("returns the count and lowest score when holdings exist", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "MSFT" }, { ticker: "VOD.L" }],
        scoresLowest: { ticker: "VOD.L", score: 22 },
      }),
      {
        userId: "u1",
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAt: "2026-06-12T10:00:00Z",
        nowMs: new Date("2026-06-13T10:00:00Z").getTime(),
      },
    );
    expect(ctx.holdingsCount).toBe(2);
    expect(ctx.lowestScoringTicker).toEqual({ ticker: "VOD.L", score: 22 });
  });
});

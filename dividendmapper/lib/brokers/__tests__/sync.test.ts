import { describe, it, expect } from "vitest";
import { buildSyncPlan, type BuildSyncPlanInput } from "@/lib/brokers/sync";
import type { ExistingHolding } from "@/lib/brokers/reconcile";
import type { BrokerDividend, BrokerInstrument, BrokerPosition } from "@/lib/brokers/types";

const USER = "user-1";
const CONN = "conn-1";

function instrument(p: Partial<BrokerInstrument> & Pick<BrokerInstrument, "ticker">): BrokerInstrument {
  return {
    ticker: p.ticker,
    isin: p.isin ?? null,
    name: p.name ?? null,
    currencyCode: p.currencyCode ?? null,
    type: p.type ?? "EQUITY",
  };
}

function position(p: Partial<BrokerPosition> & Pick<BrokerPosition, "ticker">): BrokerPosition {
  return {
    ticker: p.ticker,
    quantity: p.quantity ?? 10,
    averagePrice: p.averagePrice ?? 100,
    currentPrice: p.currentPrice ?? null,
  };
}

function dividend(p: Partial<BrokerDividend> & Pick<BrokerDividend, "ticker">): BrokerDividend {
  return {
    reference: p.reference ?? null,
    ticker: p.ticker,
    amount: p.amount ?? 1.23,
    currency: p.currency ?? "GBP",
    grossAmountPerShare: p.grossAmountPerShare ?? null,
    paidOn: p.paidOn ?? "2026-05-29T17:09:43.000+03:00",
    type: p.type ?? "DIVIDEND",
  };
}

function input(overrides: Partial<BuildSyncPlanInput>): BuildSyncPlanInput {
  return {
    userId: USER,
    connectionId: CONN,
    wrapper: "isa",
    accountCurrency: "GBP",
    positions: [],
    dividends: [],
    instruments: [],
    existingHoldings: [],
    ...overrides,
  };
}

describe("buildSyncPlan — holdings mapping", () => {
  it("inserts a US position with the scoring ticker, USD cost (no conversion), and provenance", () => {
    const plan = buildSyncPlan(
      input({
        positions: [position({ ticker: "FOUR_US_EQ", quantity: 9, averagePrice: 66.08 })],
        instruments: [instrument({ ticker: "FOUR_US_EQ", currencyCode: "USD" })],
      }),
    );
    expect(plan.holdingUpdates).toEqual([]);
    expect(plan.holdingArchiveIds).toEqual([]);
    expect(plan.holdingInserts).toHaveLength(1);
    expect(plan.holdingInserts[0]).toEqual({
      user_id: USER,
      ticker: "FOUR",
      quantity: 9,
      avg_cost: 66.08,
      cost_currency: "USD",
      wrapper: "isa",
      source: "trading212",
      external_ref: "FOUR_US_EQ",
      connection_id: CONN,
    });
  });

  it("converts a GBX (pence) LSE position to GBP cost basis (÷100)", () => {
    const plan = buildSyncPlan(
      input({
        positions: [position({ ticker: "TRIGl_EQ", quantity: 64.74, averagePrice: 76.21713142 })],
        instruments: [instrument({ ticker: "TRIGl_EQ", currencyCode: "GBX" })],
      }),
    );
    expect(plan.holdingInserts[0]).toMatchObject({
      ticker: "TRIG.L",
      avg_cost: 0.7622, // 76.21713142p ÷100, rounded to the column's 4 dp
      cost_currency: "GBP",
      external_ref: "TRIGl_EQ",
    });
  });

  it("falls back to the exchange heuristic when instrument metadata is missing (LSE → GBP ÷100)", () => {
    const plan = buildSyncPlan(
      input({
        positions: [position({ ticker: "VODl_EQ", averagePrice: 70 })],
        instruments: [],
      }),
    );
    expect(plan.holdingInserts[0]).toMatchObject({
      ticker: "VOD.L",
      avg_cost: 0.7,
      cost_currency: "GBP",
    });
  });

  it("handles a USD-denominated ETF listed on the LSE (currencyCode wins over the .L suffix)", () => {
    const plan = buildSyncPlan(
      input({
        positions: [position({ ticker: "XNASl_EQ", averagePrice: 25 })],
        instruments: [instrument({ ticker: "XNASl_EQ", currencyCode: "USD" })],
      }),
    );
    expect(plan.holdingInserts[0]).toMatchObject({
      ticker: "XNAS.L",
      avg_cost: 25,
      cost_currency: "USD",
    });
  });

  it("updates an existing synced holding (by connection+externalRef) instead of inserting", () => {
    const existing: ExistingHolding[] = [
      {
        id: "h1",
        tickerScoring: "FOUR",
        wrapper: "isa",
        source: "trading212",
        archivedAt: null,
        externalRef: "FOUR_US_EQ",
        connectionId: CONN,
      },
    ];
    const plan = buildSyncPlan(
      input({
        existingHoldings: existing,
        positions: [position({ ticker: "FOUR_US_EQ", quantity: 12, averagePrice: 50 })],
        instruments: [instrument({ ticker: "FOUR_US_EQ", currencyCode: "USD" })],
      }),
    );
    expect(plan.holdingInserts).toEqual([]);
    expect(plan.holdingUpdates).toEqual([{ id: "h1", quantity: 12, avg_cost: 50 }]);
  });

  it("archives a synced holding for this connection that no longer appears (sold)", () => {
    const existing: ExistingHolding[] = [
      {
        id: "sold1",
        tickerScoring: "OLD",
        wrapper: "isa",
        source: "trading212",
        archivedAt: null,
        externalRef: "OLD_US_EQ",
        connectionId: CONN,
      },
    ];
    const plan = buildSyncPlan(input({ existingHoldings: existing, positions: [] }));
    expect(plan.holdingArchiveIds).toEqual(["sold1"]);
  });

  it("supersedes a matching manual holding: archives the manual + inserts the synced one", () => {
    const existing: ExistingHolding[] = [
      {
        id: "m1",
        tickerScoring: "TRIG.L",
        wrapper: "isa",
        source: "manual",
        archivedAt: null,
        externalRef: null,
        connectionId: null,
      },
    ];
    const plan = buildSyncPlan(
      input({
        existingHoldings: existing,
        positions: [position({ ticker: "TRIGl_EQ", averagePrice: 80 })],
        instruments: [instrument({ ticker: "TRIGl_EQ", currencyCode: "GBX" })],
      }),
    );
    expect(plan.holdingArchiveIds).toEqual(["m1"]);
    expect(plan.holdingInserts).toHaveLength(1);
    expect(plan.holdingInserts[0]).toMatchObject({ ticker: "TRIG.L", source: "trading212" });
  });

  it("threads the chosen wrapper onto every inserted holding", () => {
    const plan = buildSyncPlan(
      input({
        wrapper: "gia",
        positions: [position({ ticker: "FOUR_US_EQ" })],
        instruments: [instrument({ ticker: "FOUR_US_EQ", currencyCode: "USD" })],
      }),
    );
    expect(plan.holdingInserts[0].wrapper).toBe("gia");
  });
});

describe("buildSyncPlan — dividends mapping", () => {
  it("uses the T212 reference as external_id, slices paidOn to a date, lowercases type, maps the scoring ticker", () => {
    const plan = buildSyncPlan(
      input({
        dividends: [
          dividend({
            reference: "uuid-abc",
            ticker: "VODl_EQ",
            amount: 4.5,
            currency: "GBP",
            grossAmountPerShare: 0.09,
            paidOn: "2026-05-29T17:09:43.000+03:00",
            type: "DIVIDEND",
          }),
        ],
        instruments: [instrument({ ticker: "VODl_EQ", currencyCode: "GBX" })],
      }),
    );
    expect(plan.dividendRows).toHaveLength(1);
    expect(plan.dividendRows[0]).toEqual({
      user_id: USER,
      connection_id: CONN,
      ticker: "VODl_EQ",
      ticker_scoring: "VOD.L",
      wrapper: "isa",
      amount: 4.5,
      currency: "GBP",
      gross_amount_per_share: 0.09,
      paid_on: "2026-05-29",
      type: "dividend",
      external_id: "uuid-abc",
      source: "trading212",
    });
  });

  it("normalises PROPERTY_INCOME_DISTRIBUTION (UK REIT PID) type to lowercase", () => {
    const plan = buildSyncPlan(
      input({ dividends: [dividend({ reference: "r1", ticker: "SREIl_EQ", type: "PROPERTY_INCOME_DISTRIBUTION" })] }),
    );
    expect(plan.dividendRows[0].type).toBe("property_income_distribution");
  });

  it("derives a deterministic external_id hash when the reference is absent", () => {
    const div = dividend({ reference: null, ticker: "VODl_EQ", amount: 4.5, paidOn: "2026-05-29T00:00:00Z", grossAmountPerShare: 0.09 });
    const a = buildSyncPlan(input({ dividends: [div] }));
    const b = buildSyncPlan(input({ dividends: [div] }));
    expect(a.dividendRows[0].external_id).toBe(b.dividendRows[0].external_id);
    expect(a.dividendRows[0].external_id).not.toBe("");
    // a different payment hashes differently
    const c = buildSyncPlan(input({ dividends: [dividend({ reference: null, ticker: "VODl_EQ", amount: 9.9, paidOn: "2026-05-29T00:00:00Z" })] }));
    expect(c.dividendRows[0].external_id).not.toBe(a.dividendRows[0].external_id);
  });

  it("keeps the dividend amount in the account currency even for a US holding", () => {
    const plan = buildSyncPlan(
      input({
        accountCurrency: "GBP",
        dividends: [dividend({ reference: "r2", ticker: "FOUR_US_EQ", amount: 1.1, currency: "GBP" })],
        instruments: [instrument({ ticker: "FOUR_US_EQ", currencyCode: "USD" })],
      }),
    );
    expect(plan.dividendRows[0]).toMatchObject({ ticker_scoring: "FOUR", currency: "GBP", amount: 1.1 });
  });
});

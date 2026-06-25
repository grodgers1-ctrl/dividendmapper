import { describe, it, expect } from "vitest";
import { buildIncomeCalendar } from "../income-calendar";

const ratesToGbp = { GBP: 1, USD: 0.79, GBp: 0.01, GBX: 0.01 };

describe("buildIncomeCalendar", () => {
  const now = new Date("2026-06-23T12:00:00Z");

  it("aggregates past-actual user_dividends by paid-on month, FX-converted to primary currency", () => {
    const userDividends = [
      { paid_on: "2026-04-15", amount: 100, currency: "USD", wrapper: "gia" as const },   // April → £79
      { paid_on: "2026-04-22", amount: 50, currency: "USD", wrapper: "gia" as const },    // April → £39.50
      { paid_on: "2026-05-10", amount: 80, currency: "GBP", wrapper: "isa" as const },    // May → £80
      { paid_on: "2026-03-01", amount: 200, currency: "USD", wrapper: "gia" as const },   // March → £158
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const aprBucket = result.months.find((m) => m.ym === "2026-04");
    expect(aprBucket?.gbp).toBeCloseTo(118.5, 2);
    expect(aprBucket?.kind).toBe("actual");
    const mayBucket = result.months.find((m) => m.ym === "2026-05");
    expect(mayBucket?.gbp).toBe(80);
    expect(mayBucket?.kind).toBe("actual");
  });

  it("marks the current calendar month as 'partial'", () => {
    const userDividends = [
      { paid_on: "2026-06-05", amount: 10, currency: "GBP", wrapper: "isa" as const },
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const junBucket = result.months.find((m) => m.ym === "2026-06");
    expect(junBucket?.kind).toBe("partial");
    expect(junBucket?.gbp).toBe(10);
  });

  it("excludes current-month forecast contributions from the partial bucket", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 15, wrapper: "gia" as const, created_at: "2024-01-01" },
    ];
    const exDivByTicker = {
      AAPL: {
        ex_date: "2026-06-25",
        pay_date: "2026-06-28",
        amount: 1.05,
        currency: "USD",
      },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    const junBucket = result.months.find((m) => m.ym === "2026-06");
    expect(junBucket?.kind).toBe("partial");
    expect(junBucket?.gbp).toBe(0); // forecast in current month not included
    expect(result.nextThree).toHaveLength(1);
    expect(result.nextThree[0].ticker).toBe("AAPL");
  });

  it("aggregates future-forecast ex-divs by pay-date month, multiplied by quantity", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 15, wrapper: "gia" as const, created_at: "2024-01-01" },
      { ticker: "ULVR.L", quantity: 40, wrapper: "isa" as const, created_at: "2024-01-01" },
    ];
    const exDivByTicker = {
      AAPL: {
        ex_date: "2026-07-15",
        pay_date: "2026-08-14",
        amount: 1.05,
        currency: "USD",
      },
      "ULVR.L": {
        ex_date: "2026-09-01",
        pay_date: "2026-10-05",
        amount: 159.42,
        currency: "GBp",
      },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    const augBucket = result.months.find((m) => m.ym === "2026-08");
    expect(augBucket?.gbp).toBeCloseTo(15 * 1.05 * 0.79, 2); // 12.4425
    expect(augBucket?.kind).toBe("confirmed-forecast");
    const octBucket = result.months.find((m) => m.ym === "2026-10");
    expect(octBucket?.gbp).toBeCloseTo(40 * 159.42 * 0.01, 2); // 63.768
    expect(octBucket?.kind).toBe("confirmed-forecast");
  });

  it("returns the next 3 ex-divs sorted ascending by ex-date, joined to holdings, with wrapper", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 15, wrapper: "gia" as const, created_at: "2024-01-01" },
      { ticker: "ULVR.L", quantity: 40, wrapper: "isa" as const, created_at: "2024-01-01" },
      { ticker: "PHP.L", quantity: 60, wrapper: "isa" as const, created_at: "2024-01-01" },
    ];
    const exDivByTicker = {
      AAPL: { ex_date: "2026-08-15", pay_date: "2026-09-14", amount: 1.05, currency: "USD" },
      "ULVR.L": { ex_date: "2026-09-01", pay_date: "2026-10-05", amount: 159.42, currency: "GBp" },
      "PHP.L": { ex_date: "2026-07-02", pay_date: "2026-08-14", amount: 1.68, currency: "GBp" },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    expect(result.nextThree.map((n) => n.ticker)).toEqual(["PHP.L", "AAPL", "ULVR.L"]);
    expect(result.nextThree[0].exDate).toBe("2026-07-02");
    expect(result.nextThree[0].gbp).toBeCloseTo(60 * 1.68 * 0.01, 2); // 1.008
    expect(result.nextThree[0].wrapper).toBe("isa");
  });

  it("returns at most 3 in nextThree even when more ex-divs exist", () => {
    const holdings = ["A", "B", "C", "D", "E"].map((t) => ({
      ticker: t,
      quantity: 10,
      wrapper: "gia" as const,
      created_at: "2024-01-01",
    }));
    const exDivByTicker = Object.fromEntries(
      ["A", "B", "C", "D", "E"].map((t, i) => [
        t,
        { ex_date: `2026-07-0${i + 1}`, pay_date: null, amount: 1, currency: "USD" },
      ]),
    );
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    expect(result.nextThree).toHaveLength(3);
  });

  it("excludes user_dividends outside the past-6-months window", () => {
    const userDividends = [
      { paid_on: "2025-10-01", amount: 999, currency: "GBP", wrapper: "isa" as const }, // out of window
      { paid_on: "2026-01-01", amount: 50, currency: "GBP", wrapper: "isa" as const },  // in window
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const total = result.months.reduce((s, m) => s + m.gbp, 0);
    expect(total).toBe(50);
  });

  it("ignores ex-divs with a missing or unparseable currency rate", () => {
    const holdings = [{ ticker: "WEIRD", quantity: 10, wrapper: "gia" as const, created_at: "2024-01-01" }];
    const exDivByTicker = {
      WEIRD: { ex_date: "2026-07-15", pay_date: "2026-08-14", amount: 1, currency: "ZZZ" },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    const augBucket = result.months.find((m) => m.ym === "2026-08");
    expect(augBucket?.gbp).toBe(0);
    expect(result.nextThree).toHaveLength(0);
  });
});

describe("buildIncomeCalendar — v2 segments + wrapper aggregation", () => {
  const now = new Date("2026-06-23T12:00:00Z");

  it("returns a `segments` array on each month, preserving legacy `gbp` + `kind` for back-compat", () => {
    const userDividends = [
      { paid_on: "2026-04-15", amount: 100, currency: "USD", wrapper: "isa" as const },
      { paid_on: "2026-04-22", amount: 200, currency: "USD", wrapper: "gia" as const },
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const apr = result.months.find((m) => m.ym === "2026-04");
    expect(apr?.gbp).toBeCloseTo(237, 1);
    expect(apr?.kind).toBe("actual");
    expect(apr?.segments).toHaveLength(1);
    expect(apr?.segments[0]).toMatchObject({ kind: "actual" });
    expect(apr?.segments[0].primary).toBeCloseTo(237, 1);
  });

  it("aggregates by wrapper when the wrapper filter is applied", () => {
    const userDividends = [
      { paid_on: "2026-04-15", amount: 100, currency: "GBP", wrapper: "isa" as const },
      { paid_on: "2026-04-22", amount: 200, currency: "GBP", wrapper: "gia" as const },
    ];
    const all = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      wrapperFilter: "all",
    });
    const onlyIsa = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      wrapperFilter: "isa",
    });
    expect(all.months.find((m) => m.ym === "2026-04")?.gbp).toBe(300);
    expect(onlyIsa.months.find((m) => m.ym === "2026-04")?.gbp).toBe(100);
  });

  it("returns 19 buckets (6 back + current + 12 forward)", () => {
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    expect(result.months).toHaveLength(19);
    expect(result.months[0].ym).toBe("2025-12");
    expect(result.months[6].kind).toBe("partial");
    expect(result.months[6].ym).toBe("2026-06");
    expect(result.months[18].ym).toBe("2027-06");
  });

  it("US locale primary currency = USD; UK holdings convert", () => {
    const userDividends = [
      { paid_on: "2026-04-10", amount: 100, currency: "USD", wrapper: "ira" as const },
      { paid_on: "2026-04-12", amount: 50, currency: "GBP", wrapper: "ira" as const },
    ];
    const ratesUsd = { USD: 1, GBP: 1 / 0.79 };
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp: ratesUsd,
      now,
      locale: "us",
    });
    const apr = result.months.find((m) => m.ym === "2026-04");
    expect(apr?.gbp).toBeCloseTo(100 + 50 / 0.79, 2);
    expect(result.primaryCurrency).toBe("USD");
  });

  it("respects `holdings.created_at` floor — does NOT back-project before the user owned the position", () => {
    // Slice A intentionally doesn't back-project. With no exDivByTicker entry,
    // past forecast buckets stay empty even if holdings exist. Slice B fills these.
    const holdings = [
      { ticker: "AAPL", quantity: 10, wrapper: "gia" as const, created_at: "2026-06-01" },
    ];
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const mar = result.months.find((m) => m.ym === "2026-03");
    expect(mar?.gbp).toBe(0);
  });

  it("uses projectedNext12mByTicker to fill future buckets that don't have a confirmed forecast", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 100, wrapper: "isa" as const, created_at: "2025-01-01" },
    ];
    const projectedNext12mByTicker = {
      AAPL: [
        {
          ex_date: "2026-08-15",
          pay_date: "2026-08-29",
          per_share_amount: 0.30,
          currency: "USD",
          confidence: "cadence+growth" as const,
        },
      ],
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      projectedNext12mByTicker,
    });
    const aug = result.months.find((m) => m.ym === "2026-08");
    expect(aug?.segments.some((s) => s.kind === "projected-growth")).toBe(true);
    expect(aug?.gbp).toBeCloseTo(100 * 0.30 * 0.79, 2);
  });

  it("forward projection does NOT overwrite a confirmed-forecast in the same month", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 100, wrapper: "isa" as const, created_at: "2025-01-01" },
    ];
    const exDivByTicker = {
      AAPL: { ex_date: "2026-08-15", pay_date: "2026-08-29", amount: 0.25, currency: "USD" },
    };
    const projectedNext12mByTicker = {
      AAPL: [
        {
          ex_date: "2026-08-15",
          pay_date: "2026-08-29",
          per_share_amount: 0.30,
          currency: "USD",
          confidence: "cadence" as const,
        },
      ],
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
      projectedNext12mByTicker,
    });
    const aug = result.months.find((m) => m.ym === "2026-08");
    expect(aug?.segments).toHaveLength(1);
    expect(aug?.segments[0].kind).toBe("confirmed-forecast");
  });

  it("backward projection respects holdings.created_at floor", () => {
    const holdings = [
      { ticker: "MSFT", quantity: 50, wrapper: "gia" as const, created_at: "2026-04-01" },
    ];
    const projectedHistorical12mByTicker = {
      MSFT: [
        { ex_date: "2025-12-15", pay_date: "2025-12-22", per_share_amount: 0.80, currency: "USD", confidence: "cadence" as const },
        { ex_date: "2026-05-15", pay_date: "2026-05-22", per_share_amount: 0.80, currency: "USD", confidence: "cadence" as const },
      ],
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      projectedHistorical12mByTicker,
    });
    expect(result.months.find((m) => m.ym === "2025-12")?.gbp).toBe(0);
    expect(result.months.find((m) => m.ym === "2026-05")?.gbp).toBeCloseTo(50 * 0.80 * 0.79, 2);
  });

  it("backward projection skips months that already have actuals from user_dividends", () => {
    const holdings = [
      { ticker: "MSFT", quantity: 50, wrapper: "gia" as const, created_at: "2024-01-01" },
    ];
    const userDividends = [
      { paid_on: "2026-05-12", amount: 50, currency: "GBP", wrapper: "gia" as const },
    ];
    const projectedHistorical12mByTicker = {
      MSFT: [
        { ex_date: "2026-05-15", pay_date: "2026-05-22", per_share_amount: 0.80, currency: "USD", confidence: "cadence" as const },
      ],
    };
    const result = buildIncomeCalendar({
      userDividends,
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      projectedHistorical12mByTicker,
    });
    const may = result.months.find((m) => m.ym === "2026-05");
    expect(may?.segments).toHaveLength(1);
    expect(may?.segments[0].kind).toBe("actual");
    expect(may?.gbp).toBe(50);
  });

  it("nextThree GBP rounds correctly with multiple holdings of the same wrapper", () => {
    const holdings = [
      { ticker: "PHP.L", quantity: 100, wrapper: "isa" as const, created_at: "2024-01-01" },
      { ticker: "BATS.L", quantity: 50, wrapper: "isa" as const, created_at: "2024-01-01" },
    ];
    const exDivByTicker = {
      "PHP.L": { ex_date: "2026-07-02", pay_date: "2026-07-09", amount: 0.42, currency: "GBp" },
      "BATS.L": { ex_date: "2026-07-09", pay_date: "2026-08-06", amount: 5.85, currency: "GBp" },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    expect(result.nextThree).toHaveLength(2);
    expect(result.nextThree[0].ticker).toBe("PHP.L");
    expect(result.nextThree[0].gbp).toBeCloseTo(100 * 0.42 * 0.01, 4);
  });
});

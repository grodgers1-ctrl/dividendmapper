import { describe, it, expect } from "vitest";
import { buildIncomeCalendar } from "../income-calendar";

const ratesToGbp = { GBP: 1, USD: 0.79, GBp: 0.01, GBX: 0.01 };

describe("buildIncomeCalendar", () => {
  const now = new Date("2026-06-23T12:00:00Z");

  it("aggregates past-actual user_dividends by paid-on month, FX-converted to GBP", () => {
    const userDividends = [
      { paid_on: "2026-04-15", amount: 100, currency: "USD" },   // April → £79
      { paid_on: "2026-04-22", amount: 50, currency: "USD" },    // April → £39.50
      { paid_on: "2026-05-10", amount: 80, currency: "GBP" },    // May → £80
      { paid_on: "2026-03-01", amount: 200, currency: "USD" },   // March → £158
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
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
      { paid_on: "2026-06-05", amount: 10, currency: "GBP" },
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
    });
    const junBucket = result.months.find((m) => m.ym === "2026-06");
    expect(junBucket?.kind).toBe("partial");
    expect(junBucket?.gbp).toBe(10);
  });

  it("excludes current-month forecast contributions from the partial bucket", () => {
    const holdings = [{ ticker: "AAPL", quantity: 15 }];
    const exDivByTicker = {
      // Pay date lands in the current calendar month (June 2026 for the
      // injected `now`). Forecast contributions in the current bucket are
      // intentionally dropped — the partial month shows cash banked, not
      // run-rate.
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
    });
    const junBucket = result.months.find((m) => m.ym === "2026-06");
    expect(junBucket?.kind).toBe("partial");
    expect(junBucket?.gbp).toBe(0); // forecast in current month not included
    // But the ex-div still appears in nextThree (it's a future ex-date).
    expect(result.nextThree).toHaveLength(1);
    expect(result.nextThree[0].ticker).toBe("AAPL");
  });

  it("aggregates future-forecast ex-divs by pay-date month, multiplied by quantity", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 15 },
      { ticker: "ULVR.L", quantity: 40 },
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
    });
    const augBucket = result.months.find((m) => m.ym === "2026-08");
    expect(augBucket?.gbp).toBeCloseTo(15 * 1.05 * 0.79, 2); // 12.4425
    expect(augBucket?.kind).toBe("forecast");
    const octBucket = result.months.find((m) => m.ym === "2026-10");
    expect(octBucket?.gbp).toBeCloseTo(40 * 159.42 * 0.01, 2); // 63.768
    expect(octBucket?.kind).toBe("forecast");
  });

  it("returns the 12-month window: 6 past months + current + 5 future from 'now'", () => {
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
    });
    expect(result.months.map((m) => m.ym)).toEqual([
      "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
      "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
    ]);
  });

  it("returns the next 3 ex-divs sorted ascending by ex-date, joined to holdings", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 15 },
      { ticker: "ULVR.L", quantity: 40 },
      { ticker: "PHP.L", quantity: 60 },
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
    });
    expect(result.nextThree.map((n) => n.ticker)).toEqual(["PHP.L", "AAPL", "ULVR.L"]);
    expect(result.nextThree[0].exDate).toBe("2026-07-02");
    expect(result.nextThree[0].gbp).toBeCloseTo(60 * 1.68 * 0.01, 2); // 1.008
  });

  it("returns at most 3 in nextThree even when more ex-divs exist", () => {
    const holdings = ["A", "B", "C", "D", "E"].map((t) => ({ ticker: t, quantity: 10 }));
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
    });
    expect(result.nextThree).toHaveLength(3);
  });

  it("excludes user_dividends outside the past-6-months window", () => {
    const userDividends = [
      { paid_on: "2025-10-01", amount: 999, currency: "GBP" }, // out of window (> 6mo ago)
      { paid_on: "2026-01-01", amount: 50, currency: "GBP" },  // in window
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
    });
    const total = result.months.reduce((s, m) => s + m.gbp, 0);
    expect(total).toBe(50);
  });

  it("ignores ex-divs with a missing or unparseable currency rate", () => {
    const holdings = [{ ticker: "WEIRD", quantity: 10 }];
    const exDivByTicker = {
      WEIRD: { ex_date: "2026-07-15", pay_date: "2026-08-14", amount: 1, currency: "ZZZ" },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
    });
    const augBucket = result.months.find((m) => m.ym === "2026-08");
    expect(augBucket?.gbp).toBe(0);
    expect(result.nextThree).toHaveLength(0);
  });
});

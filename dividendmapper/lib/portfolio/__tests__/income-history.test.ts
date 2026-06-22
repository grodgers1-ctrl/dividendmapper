import { describe, it, expect } from "vitest";
import {
  rollupIncomeHistoryToGbp,
  type IncomeHistoryRow,
} from "@/lib/portfolio/income-history";

describe("rollupIncomeHistoryToGbp", () => {
  it("returns an empty array when there are no rows", () => {
    expect(rollupIncomeHistoryToGbp([], {})).toEqual([]);
  });

  it("sums per-currency totals at each snapshot date using the provided rates", () => {
    const rows: IncomeHistoryRow[] = [
      { snapshot_at: "2026-05-01", currency: "GBP", total_annual_run_rate: 1000 },
      { snapshot_at: "2026-05-01", currency: "USD", total_annual_run_rate: 500 },
      { snapshot_at: "2026-06-01", currency: "GBP", total_annual_run_rate: 1100 },
      { snapshot_at: "2026-06-01", currency: "USD", total_annual_run_rate: 600 },
    ];
    const rates = { GBP: 1, USD: 0.8 };
    const out = rollupIncomeHistoryToGbp(rows, rates);
    expect(out).toHaveLength(2);
    // 1000 + 500 * 0.8 = 1400
    expect(out[0]).toEqual({ at: new Date("2026-05-01T00:00:00Z"), value: 1400 });
    // 1100 + 600 * 0.8 = 1580
    expect(out[1]).toEqual({ at: new Date("2026-06-01T00:00:00Z"), value: 1580 });
  });

  it("sorts output by date ascending regardless of input order", () => {
    const rows: IncomeHistoryRow[] = [
      { snapshot_at: "2026-06-01", currency: "GBP", total_annual_run_rate: 1100 },
      { snapshot_at: "2026-04-01", currency: "GBP", total_annual_run_rate: 900 },
      { snapshot_at: "2026-05-01", currency: "GBP", total_annual_run_rate: 1000 },
    ];
    const out = rollupIncomeHistoryToGbp(rows, { GBP: 1 });
    expect(out.map((p) => p.at.toISOString().slice(0, 10))).toEqual([
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
    ]);
  });

  it("silently omits rows whose currency has no rate", () => {
    const rows: IncomeHistoryRow[] = [
      { snapshot_at: "2026-05-01", currency: "GBP", total_annual_run_rate: 1000 },
      { snapshot_at: "2026-05-01", currency: "JPY", total_annual_run_rate: 100_000 },
    ];
    const out = rollupIncomeHistoryToGbp(rows, { GBP: 1 });
    expect(out).toEqual([{ at: new Date("2026-05-01T00:00:00Z"), value: 1000 }]);
  });

  it("skips dates where every row's currency lacked a rate", () => {
    const rows: IncomeHistoryRow[] = [
      { snapshot_at: "2026-05-01", currency: "JPY", total_annual_run_rate: 100_000 },
      { snapshot_at: "2026-06-01", currency: "GBP", total_annual_run_rate: 1000 },
    ];
    const out = rollupIncomeHistoryToGbp(rows, { GBP: 1 });
    expect(out).toEqual([{ at: new Date("2026-06-01T00:00:00Z"), value: 1000 }]);
  });
});

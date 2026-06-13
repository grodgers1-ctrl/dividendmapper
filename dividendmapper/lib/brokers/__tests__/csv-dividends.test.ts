import { describe, it, expect } from "vitest";
import {
  parseCsvDividends,
  buildCsvDividendImportPlan,
  type ParsedDividend,
} from "@/lib/brokers/csv-dividends";

// ---------------------------------------------------------------------------
// parseCsvDividends
// ---------------------------------------------------------------------------

describe("parseCsvDividends — happy path", () => {
  it("parses canonical headers into ok rows", () => {
    const csv = [
      "ticker,amount,paid_on,currency,wrapper,gross_amount_per_share,type",
      "VOD.L,12.50,2026-03-01,GBP,isa,0.075,dividend",
    ].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual<ParsedDividend[]>([
      {
        line: 1,
        ticker: "VOD.L",
        amount: 12.5,
        paidOn: "2026-03-01",
        currency: "GBP",
        wrapper: "isa",
        grossPerShare: 0.075,
        type: "dividend",
      },
    ]);
  });

  it("matches header aliases (symbol/value/date) case-insensitively", () => {
    const csv = ["Symbol,Value,Date", "aapl,3.20,2026-02-15"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ticker: "AAPL", amount: 3.2, paidOn: "2026-02-15" });
  });

  it("strips a leading UTF-8 BOM on the header row", () => {
    const csv = ["﻿ticker,amount,paid_on", "TSCO.L,5.10,2026-01-09"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ticker: "TSCO.L", amount: 5.1, paidOn: "2026-01-09" });
  });

  it("accepts slash-separated ISO dates and normalises to dashes", () => {
    const csv = ["ticker,amount,paid_on", "VOD.L,1,2026/04/30"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.rows[0].paidOn).toBe("2026-04-30");
  });

  it("applies default wrapper, currency GBP, type dividend, null gross when columns absent", () => {
    const csv = ["ticker,amount,paid_on", "ULVR.L,8,2026-05-01"].join("\n");
    const r = parseCsvDividends(csv, { defaultWrapper: "sipp" });
    expect(r.rows[0]).toMatchObject({
      wrapper: "sipp",
      currency: "GBP",
      type: "dividend",
      grossPerShare: null,
    });
  });

  it("defaults wrapper to gia with no options", () => {
    const csv = ["ticker,amount,paid_on", "ULVR.L,8,2026-05-01"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.rows[0].wrapper).toBe("gia");
  });

  it("lowercases the type value", () => {
    const csv = ["ticker,amount,paid_on,type", "BP.L,2,2026-05-01,PROPERTY_INCOME"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.rows[0].type).toBe("property_income");
  });
});

describe("parseCsvDividends — validation", () => {
  it("reports missing required columns instead of rows", () => {
    const csv = ["ticker,wrapper", "VOD.L,isa"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.missingColumns.sort()).toEqual(["amount", "paid_on"]);
    expect(r.rows).toEqual([]);
  });

  it("flags a non-positive amount", () => {
    const csv = ["ticker,amount,paid_on", "VOD.L,0,2026-01-01"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_amount", ticker: "VOD.L" }]);
  });

  it("flags a non-numeric amount", () => {
    const csv = ["ticker,amount,paid_on", "VOD.L,abc,2026-01-01"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_amount", ticker: "VOD.L" }]);
  });

  it("flags a malformed date", () => {
    const csv = ["ticker,amount,paid_on", "VOD.L,1,01-03-2026"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_date", ticker: "VOD.L" }]);
  });

  it("flags an impossible calendar date", () => {
    const csv = ["ticker,amount,paid_on", "VOD.L,1,2026-02-30"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_date", ticker: "VOD.L" }]);
  });

  it("flags an invalid ticker", () => {
    const csv = ["ticker,amount,paid_on", "not a ticker,1,2026-01-01"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors[0]).toMatchObject({ line: 1, status: "invalid_ticker" });
  });

  it("flags an unrecognised currency", () => {
    const csv = ["ticker,amount,paid_on,currency", "VOD.L,1,2026-01-01,EUR"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_currency", ticker: "VOD.L" }]);
  });

  it("flags an unrecognised wrapper", () => {
    const csv = ["ticker,amount,paid_on,wrapper", "VOD.L,1,2026-01-01,mattress"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_wrapper", ticker: "VOD.L" }]);
  });

  it("flags a present-but-invalid gross_amount_per_share", () => {
    const csv = ["ticker,amount,paid_on,gross_amount_per_share", "VOD.L,1,2026-01-01,-0.5"].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_gross", ticker: "VOD.L" }]);
  });

  it("keeps good rows and collects bad ones together", () => {
    const csv = [
      "ticker,amount,paid_on",
      "VOD.L,1,2026-01-01",
      "BAD TICKER,1,2026-01-01",
      "TSCO.L,2,2026-02-01",
    ].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.rows.map((x) => x.ticker)).toEqual(["VOD.L", "TSCO.L"]);
    expect(r.errors).toEqual([{ line: 2, status: "invalid_ticker", ticker: "BAD TICKER" }]);
  });

  it("ignores fully blank lines", () => {
    const csv = ["ticker,amount,paid_on", "VOD.L,1,2026-01-01", "", "  "].join("\n");
    const r = parseCsvDividends(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCsvDividendImportPlan
// ---------------------------------------------------------------------------

const USER = "u1";

function row(p: Partial<ParsedDividend> & Pick<ParsedDividend, "ticker">): ParsedDividend {
  return {
    line: p.line ?? 1,
    ticker: p.ticker,
    amount: p.amount ?? 10,
    paidOn: p.paidOn ?? "2026-01-01",
    currency: p.currency ?? "GBP",
    wrapper: p.wrapper ?? "isa",
    grossPerShare: p.grossPerShare ?? null,
    type: p.type ?? "dividend",
  };
}

describe("buildCsvDividendImportPlan", () => {
  it("builds a user_dividends upsert row with source csv, both tickers, null connection", () => {
    const plan = buildCsvDividendImportPlan({ userId: USER, rows: [row({ ticker: "VOD.L" })] });
    expect(plan.upserts).toHaveLength(1);
    const u = plan.upserts[0];
    expect(u).toMatchObject({
      user_id: USER,
      connection_id: null,
      ticker: "VOD.L",
      ticker_scoring: "VOD.L",
      wrapper: "isa",
      amount: 10,
      currency: "GBP",
      gross_amount_per_share: null,
      paid_on: "2026-01-01",
      type: "dividend",
      source: "csv",
    });
  });

  it("prefixes the external_id with csv: and makes it deterministic", () => {
    const a = buildCsvDividendImportPlan({ userId: USER, rows: [row({ ticker: "VOD.L" })] });
    const b = buildCsvDividendImportPlan({ userId: USER, rows: [row({ ticker: "VOD.L" })] });
    expect(a.upserts[0].external_id).toMatch(/^csv:[0-9a-f]{32}$/);
    expect(a.upserts[0].external_id).toBe(b.upserts[0].external_id);
  });

  it("varies external_id when amount differs (distinct payments)", () => {
    const a = buildCsvDividendImportPlan({ userId: USER, rows: [row({ ticker: "VOD.L", amount: 1 })] });
    const b = buildCsvDividendImportPlan({ userId: USER, rows: [row({ ticker: "VOD.L", amount: 2 })] });
    expect(a.upserts[0].external_id).not.toBe(b.upserts[0].external_id);
  });

  it("returns a preview with ticker, paid_on, amount, currency, type", () => {
    const plan = buildCsvDividendImportPlan({
      userId: USER,
      rows: [row({ ticker: "VOD.L", amount: 12.5, paidOn: "2026-03-01", type: "dividend" })],
    });
    expect(plan.preview).toEqual([
      { ticker: "VOD.L", paidOn: "2026-03-01", amount: 12.5, currency: "GBP", type: "dividend" },
    ]);
  });

  it("collapses rows with an identical external_id within one file (no double-upsert)", () => {
    // Same ticker/date/amount/gross → same external_id. Postgres ON CONFLICT
    // cannot touch the same row twice in one statement, so the plan must dedupe.
    const plan = buildCsvDividendImportPlan({
      userId: USER,
      rows: [
        row({ ticker: "VOD.L", amount: 5, paidOn: "2026-01-01", line: 1 }),
        row({ ticker: "VOD.L", amount: 5, paidOn: "2026-01-01", line: 2 }),
      ],
    });
    expect(plan.upserts).toHaveLength(1);
  });

  it("keeps distinct payments of the same ticker as separate upserts", () => {
    const plan = buildCsvDividendImportPlan({
      userId: USER,
      rows: [
        row({ ticker: "VOD.L", amount: 5, paidOn: "2026-01-01" }),
        row({ ticker: "VOD.L", amount: 5, paidOn: "2026-07-01" }),
      ],
    });
    expect(plan.upserts).toHaveLength(2);
  });
});

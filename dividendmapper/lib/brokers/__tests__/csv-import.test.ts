import { describe, it, expect } from "vitest";
import {
  parseCsvHoldings,
  buildCsvImportPlan,
  type CsvExistingHolding,
  type ParsedHolding,
} from "@/lib/brokers/csv-import";

// ---------------------------------------------------------------------------
// parseCsvHoldings
// ---------------------------------------------------------------------------

describe("parseCsvHoldings — happy path", () => {
  it("parses canonical headers into ok rows", () => {
    const csv = ["ticker,quantity,avg_cost,currency,wrapper", "VOD.L,100,0.75,GBP,isa"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual<ParsedHolding[]>([
      { line: 1, ticker: "VOD.L", quantity: 100, avgCost: 0.75, currency: "GBP", wrapper: "isa" },
    ]);
  });

  it("matches header aliases (symbol/shares/cost) case-insensitively", () => {
    const csv = ["Symbol,Shares,Cost", "aapl,5,180.20"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ticker: "AAPL", quantity: 5, avgCost: 180.2 });
  });

  it("strips a leading UTF-8 BOM on the header row", () => {
    const csv = ["﻿ticker,quantity,avg_cost", "TSCO.L,10,2.50"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ticker: "TSCO.L", quantity: 10, avgCost: 2.5 });
  });

  it("applies default wrapper + currency when those columns are absent", () => {
    const csv = ["ticker,quantity,avg_cost", "ULVR.L,3,42"].join("\n");
    const r = parseCsvHoldings(csv, { defaultWrapper: "sipp" });
    expect(r.rows[0]).toMatchObject({ wrapper: "sipp", currency: "GBP" });
  });

  it("defaults wrapper to gia and currency to GBP with no options", () => {
    const csv = ["ticker,quantity,avg_cost", "ULVR.L,3,42"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.rows[0]).toMatchObject({ wrapper: "gia", currency: "GBP" });
  });
});

describe("parseCsvHoldings — validation", () => {
  it("reports missing required columns instead of rows", () => {
    const csv = ["ticker,wrapper", "VOD.L,isa"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.missingColumns.sort()).toEqual(["avg_cost", "quantity"]);
    expect(r.rows).toEqual([]);
  });

  it("flags a non-positive quantity", () => {
    const csv = ["ticker,quantity,avg_cost", "VOD.L,0,1"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_quantity", ticker: "VOD.L" }]);
  });

  it("flags a non-numeric quantity", () => {
    const csv = ["ticker,quantity,avg_cost", "VOD.L,abc,1"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_quantity", ticker: "VOD.L" }]);
  });

  it("flags a negative average cost", () => {
    const csv = ["ticker,quantity,avg_cost", "VOD.L,5,-1"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_avg_cost", ticker: "VOD.L" }]);
  });

  it("flags an invalid ticker", () => {
    const csv = ["ticker,quantity,avg_cost", "not a ticker,5,1"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.errors[0]).toMatchObject({ line: 1, status: "invalid_ticker" });
  });

  it("flags an unrecognised wrapper", () => {
    const csv = ["ticker,quantity,avg_cost,wrapper", "VOD.L,5,1,mattress"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_wrapper", ticker: "VOD.L" }]);
  });

  it("flags an unrecognised currency", () => {
    const csv = ["ticker,quantity,avg_cost,currency", "VOD.L,5,1,EUR"].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.errors).toEqual([{ line: 1, status: "invalid_currency", ticker: "VOD.L" }]);
  });

  it("keeps good rows and collects bad ones together", () => {
    const csv = [
      "ticker,quantity,avg_cost",
      "VOD.L,5,1",
      "BAD TICKER,5,1",
      "TSCO.L,10,2",
    ].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.rows.map((x) => x.ticker)).toEqual(["VOD.L", "TSCO.L"]);
    expect(r.errors).toEqual([{ line: 2, status: "invalid_ticker", ticker: "BAD TICKER" }]);
  });

  it("ignores fully blank lines", () => {
    const csv = ["ticker,quantity,avg_cost", "VOD.L,5,1", "", "  "].join("\n");
    const r = parseCsvHoldings(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCsvImportPlan
// ---------------------------------------------------------------------------

const USER = "u1";

function row(p: Partial<ParsedHolding> & Pick<ParsedHolding, "ticker">): ParsedHolding {
  return {
    line: p.line ?? 1,
    ticker: p.ticker,
    quantity: p.quantity ?? 10,
    avgCost: p.avgCost ?? 1,
    currency: p.currency ?? "GBP",
    wrapper: p.wrapper ?? "isa",
  };
}

function existing(
  p: Partial<CsvExistingHolding> & Pick<CsvExistingHolding, "id" | "source">,
): CsvExistingHolding {
  return {
    id: p.id,
    ticker: p.ticker ?? "VOD.L",
    wrapper: p.wrapper ?? "isa",
    source: p.source,
    archivedAt: p.archivedAt ?? null,
  };
}

describe("buildCsvImportPlan", () => {
  it("inserts a brand-new csv holding when nothing matches", () => {
    const plan = buildCsvImportPlan({ userId: USER, rows: [row({ ticker: "VOD.L" })], existing: [] });
    expect(plan.updates).toEqual([]);
    expect(plan.supersedeArchiveIds).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toEqual({
      user_id: USER,
      ticker: "VOD.L",
      quantity: 10,
      avg_cost: 1,
      cost_currency: "GBP",
      wrapper: "isa",
      source: "csv",
      external_ref: "VOD.L",
      connection_id: null,
    });
    expect(plan.preview).toEqual([
      { ticker: "VOD.L", wrapper: "isa", quantity: 10, avgCost: 1, currency: "GBP", action: "insert" },
    ]);
  });

  it("updates an existing csv holding matched by (ticker, wrapper)", () => {
    const ex = existing({ id: "h1", source: "csv", ticker: "VOD.L", wrapper: "isa" });
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [row({ ticker: "VOD.L", wrapper: "isa", quantity: 99, avgCost: 1.23 })],
      existing: [ex],
    });
    expect(plan.inserts).toEqual([]);
    expect(plan.supersedeArchiveIds).toEqual([]);
    expect(plan.updates).toEqual([{ id: "h1", quantity: 99, avg_cost: 1.23 }]);
    expect(plan.preview[0].action).toBe("update");
  });

  it("supersedes a manual holding: archives the manual and inserts the csv row", () => {
    const manual = existing({ id: "m1", source: "manual", ticker: "LGEN.L", wrapper: "isa" });
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [row({ ticker: "LGEN.L", wrapper: "isa" })],
      existing: [manual],
    });
    expect(plan.supersedeArchiveIds).toEqual(["m1"]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.preview[0].action).toBe("supersede");
  });

  it("is idempotent on re-import: a second pass is all updates, no inserts/archives", () => {
    const ex = existing({ id: "h1", source: "csv", ticker: "VOD.L", wrapper: "isa" });
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [row({ ticker: "VOD.L", wrapper: "isa", quantity: 10, avgCost: 1 })],
      existing: [ex],
    });
    expect(plan.inserts).toEqual([]);
    expect(plan.supersedeArchiveIds).toEqual([]);
    expect(plan.updates).toEqual([{ id: "h1", quantity: 10, avg_cost: 1 }]);
  });

  it("does NOT archive csv holdings absent from the uploaded file (upload-safe)", () => {
    const stillThere = existing({ id: "h1", source: "csv", ticker: "VOD.L", wrapper: "isa" });
    const omitted = existing({ id: "h2", source: "csv", ticker: "TSCO.L", wrapper: "isa" });
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [row({ ticker: "VOD.L", wrapper: "isa" })],
      existing: [stillThere, omitted],
    });
    expect(plan.supersedeArchiveIds).toEqual([]); // h2 left untouched, not archived
    expect(plan.updates).toEqual([{ id: "h1", quantity: 10, avg_cost: 1 }]);
  });

  it("does not match the same ticker in a different wrapper", () => {
    const csvSipp = existing({ id: "h1", source: "csv", ticker: "VOD.L", wrapper: "sipp" });
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [row({ ticker: "VOD.L", wrapper: "isa" })],
      existing: [csvSipp],
    });
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({ wrapper: "isa" });
  });

  it("collapses duplicate (ticker, wrapper) rows in the same file — last wins", () => {
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [
        row({ ticker: "VOD.L", wrapper: "isa", quantity: 1, line: 1 }),
        row({ ticker: "VOD.L", wrapper: "isa", quantity: 7, line: 2 }),
      ],
      existing: [],
    });
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({ quantity: 7 });
  });

  it("ignores already-archived existing rows (treats incoming as new)", () => {
    const archivedCsv = existing({
      id: "h1",
      source: "csv",
      ticker: "VOD.L",
      wrapper: "isa",
      archivedAt: "2026-01-01T00:00:00Z",
    });
    const plan = buildCsvImportPlan({
      userId: USER,
      rows: [row({ ticker: "VOD.L", wrapper: "isa" })],
      existing: [archivedCsv],
    });
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });
});

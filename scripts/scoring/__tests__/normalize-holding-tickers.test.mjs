import { test } from "node:test";
import assert from "node:assert/strict";
import { pickBestSymbol } from "../normalize-holding-tickers.js";

test("picks .L suffix when LSE result exists for ambiguous query", () => {
  const result = pickBestSymbol("LGEN", [
    { symbol: "LGEN.L", exchange: "LSE", name: "Legal & General Group" },
    { symbol: "ALGEN.PA", exchange: "PAR", name: "genOway S.A." },
  ]);
  assert.equal(result, "LGEN.L");
});

test("returns null when no exact-prefix match exists", () => {
  const result = pickBestSymbol("LGEN", [
    { symbol: "XYZ.L", exchange: "LSE", name: "Unrelated" },
  ]);
  assert.equal(result, null);
});

test("returns the unsuffixed input when only US match exists (no .L)", () => {
  const result = pickBestSymbol("AAPL", [
    { symbol: "AAPL", exchange: "NASDAQ", name: "Apple Inc" },
  ]);
  assert.equal(result, "AAPL");
});

test("ignores OTC when LSE present", () => {
  const result = pickBestSymbol("LGEN", [
    { symbol: "LGGNF", exchange: "OTC", name: "Legal & General OTC" },
    { symbol: "LGEN.L", exchange: "LSE", name: "Legal & General Group" },
  ]);
  assert.equal(result, "LGEN.L");
});

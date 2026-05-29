import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFmpResponse } from "../fmp-coverage-matrix.js";

test("classifies full success", () => {
  const result = classifyFmpResponse(200, [{ symbol: "AAPL", price: 180 }]);
  assert.equal(result, "full");
});

test("classifies blocked-as-200 (premium query parameter)", () => {
  const result = classifyFmpResponse(200, { "Error Message": "Premium Query Parameter" });
  assert.equal(result, "blocked");
});

test("classifies blocked-as-200 (forbidden)", () => {
  const result = classifyFmpResponse(200, { "Error Message": "Forbidden" });
  assert.equal(result, "blocked");
});

test("classifies blocked-as-200 (limit reached)", () => {
  const result = classifyFmpResponse(200, { "Error Message": "Limit Reach" });
  assert.equal(result, "blocked");
});

test("classifies empty array", () => {
  const result = classifyFmpResponse(200, []);
  assert.equal(result, "empty");
});

test("classifies null body", () => {
  const result = classifyFmpResponse(200, null);
  assert.equal(result, "empty");
});

test("classifies 401 as error", () => {
  const result = classifyFmpResponse(401, { error: "Unauthorized" });
  assert.equal(result, "error");
});

test("classifies 500 as error", () => {
  const result = classifyFmpResponse(500, { message: "internal error" });
  assert.equal(result, "error");
});

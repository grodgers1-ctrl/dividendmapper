import { describe, it, expect } from "vitest";
import { computeQR1FfoPayout } from "../q_r1-ffo-payout";

describe("computeQR1FfoPayout", () => {
  it("≤ 70% scores 100", () => {
    const r = computeQR1FfoPayout({ ttmDps: 1.0, ttmFfoPerShare: 1.5 });
    expect(r.score).toBe(100);
    expect(r.humanLabel).toMatch(/67%/);
  });

  it("70-85% scores 75", () => {
    expect(computeQR1FfoPayout({ ttmDps: 0.80, ttmFfoPerShare: 1.0 }).score).toBe(75);
  });

  it("85-95% scores 50", () => {
    expect(computeQR1FfoPayout({ ttmDps: 0.90, ttmFfoPerShare: 1.0 }).score).toBe(50);
  });

  it("95-100% scores 25", () => {
    expect(computeQR1FfoPayout({ ttmDps: 0.98, ttmFfoPerShare: 1.0 }).score).toBe(25);
  });

  it("> 100% scores 0 (gate-failing payout)", () => {
    expect(computeQR1FfoPayout({ ttmDps: 1.10, ttmFfoPerShare: 1.0 }).score).toBe(0);
  });

  it("non-positive FFO returns null", () => {
    expect(computeQR1FfoPayout({ ttmDps: 1.0, ttmFfoPerShare: 0 }).score).toBeNull();
    expect(computeQR1FfoPayout({ ttmDps: 1.0, ttmFfoPerShare: -0.1 }).score).toBeNull();
  });
});

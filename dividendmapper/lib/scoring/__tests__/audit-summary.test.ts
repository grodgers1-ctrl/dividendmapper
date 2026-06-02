import { describe, it, expect } from "vitest";
import { summariseAudit, type AuditRow } from "../audit-summary";

const rows: AuditRow[] = [
  {
    ticker: "PEP",
    buy_score: 81,
    trim_score: 19,
    risk_score: 40,
    buy_quality_gate_passed: true,
    buy_failed_gates: [],
    data_quality: "sparse",
    computed_at: "2026-06-01T22:34:00Z",
  },
  {
    ticker: "VOD.L",
    buy_score: null,
    trim_score: 76,
    risk_score: 75,
    buy_quality_gate_passed: false,
    buy_failed_gates: ["GATE_2", "GATE_4"],
    data_quality: "degraded_uk",
    computed_at: "2026-06-01T22:34:00Z",
  },
  {
    ticker: "SCHD",
    buy_score: null,
    trim_score: 85,
    risk_score: 60,
    buy_quality_gate_passed: false,
    buy_failed_gates: ["GATE_4"],
    data_quality: "sparse",
    computed_at: "2026-06-01T22:34:00Z",
  },
];

describe("summariseAudit", () => {
  it("counts gate pass/DNQ", () => {
    const s = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(s.gatePassed).toBe(1);
    expect(s.gateFailed).toBe(2);
  });

  it("breaks down data_quality", () => {
    const s = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(s.dataQuality).toEqual({ clean: 0, sparse: 2, degraded_uk: 1 });
  });

  it("tallies failed gates", () => {
    const s = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(s.gateTally).toEqual({ GATE_2: 1, GATE_4: 2 });
  });

  it("flags stale when newest computed_at is over 36h old", () => {
    const fresh = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(fresh.ageHours).toBeLessThan(36);
    expect(fresh.stale).toBe(false);
    const stale = summariseAudit(rows, new Date("2026-06-04T12:00:00Z"));
    expect(stale.stale).toBe(true);
  });

  it("handles an empty set without NaN", () => {
    const s = summariseAudit([], new Date("2026-06-02T10:00:00Z"));
    expect(s.total).toBe(0);
    expect(s.newestComputedAt).toBeNull();
    expect(s.stale).toBe(true);
  });
});

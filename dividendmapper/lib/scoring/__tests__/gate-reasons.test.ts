import { describe, it, expect } from "vitest";
import { gateReason, primaryGateReason } from "../gate-reasons";

describe("gateReason", () => {
  it("maps each gate code to a human reason", () => {
    expect(gateReason("GATE_1")).toBe("Dividend not covered by cash flow");
    expect(gateReason("GATE_2")).toBe("Dividend history irregular");
    expect(gateReason("GATE_3")).toBe("Thin interest coverage");
    expect(gateReason("GATE_4")).toBe("ETF or fund — not company-scored");
    expect(gateReason("GATE_5")).toBe("Below scoring size threshold");
  });
});

describe("primaryGateReason", () => {
  it("picks the most explanatory gate when several fail", () => {
    // GATE_4 (ETF) is the clearest story → wins over GATE_1
    expect(primaryGateReason(["GATE_1", "GATE_4"])).toBe(
      "ETF or fund — not company-scored",
    );
  });
  it("orders GATE_2 above GATE_1 when both fail", () => {
    expect(primaryGateReason(["GATE_1", "GATE_2"])).toBe(
      "Dividend history irregular",
    );
  });
  it("returns null for no failed gates", () => {
    expect(primaryGateReason([])).toBeNull();
  });
});

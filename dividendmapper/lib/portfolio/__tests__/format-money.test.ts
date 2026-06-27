import { describe, it, expect } from "vitest";
import { formatMoney } from "../format-money";

describe("formatMoney", () => {
  it("rounds to whole units when no dp option", () => {
    expect(formatMoney(1727.49, "USD")).toBe("$1,727");
  });
  it("formats with dp when supplied", () => {
    expect(formatMoney(54.9031, "USD", { dp: 2 })).toBe("$54.90");
    expect(formatMoney(2.138, "GBP", { dp: 2 })).toBe("£2.14");
  });
  it("falls back to trailing ISO for unknown currency", () => {
    expect(formatMoney(100.5, "ZAR", { dp: 2 })).toBe("100.50 ZAR");
  });
});

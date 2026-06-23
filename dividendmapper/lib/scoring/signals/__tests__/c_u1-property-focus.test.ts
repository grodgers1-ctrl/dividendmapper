import { describe, it, expect } from "vitest";
import { computeCU1PropertyFocus, propertyTypeFor } from "../c_u1-property-focus";

describe("computeCU1PropertyFocus", () => {
  it("diversified property type scores 100", () => {
    expect(computeCU1PropertyFocus({ propertyType: "diversified" }).score).toBe(100);
  });

  it("single-sector REIT scores 50", () => {
    expect(computeCU1PropertyFocus({ propertyType: "industrial" }).score).toBe(50);
    expect(computeCU1PropertyFocus({ propertyType: "healthcare" }).score).toBe(50);
    expect(computeCU1PropertyFocus({ propertyType: "supermarket" }).score).toBe(50);
  });

  it("empty/missing propertyType returns null (cascade)", () => {
    expect(computeCU1PropertyFocus({ propertyType: "" }).score).toBeNull();
  });
});

describe("propertyTypeFor", () => {
  it("returns the classified property type for a known ticker", () => {
    expect(propertyTypeFor("BLND.L")).toBe("diversified");
    expect(propertyTypeFor("SGRO.L")).toBe("industrial");
  });

  it("returns null for unknown tickers", () => {
    expect(propertyTypeFor("UNKNOWN.L")).toBeNull();
    expect(propertyTypeFor("AAPL")).toBeNull();
  });
});

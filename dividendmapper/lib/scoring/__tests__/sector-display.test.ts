import { describe, it, expect } from "vitest";
import { formatSector } from "../sector-display";

describe("formatSector", () => {
  it("title-cases snake_case sector names", () => {
    expect(formatSector("consumer_staples")).toBe("Consumer Staples");
    expect(formatSector("real_estate")).toBe("Real Estate");
    expect(formatSector("consumer_discretionary")).toBe("Consumer Discretionary");
    expect(formatSector("basic_materials")).toBe("Basic Materials");
  });

  it("title-cases single-word sectors", () => {
    expect(formatSector("technology")).toBe("Technology");
    expect(formatSector("financial")).toBe("Financial");
    expect(formatSector("healthcare")).toBe("Healthcare");
    expect(formatSector("industrials")).toBe("Industrials");
    expect(formatSector("utility")).toBe("Utility");
    expect(formatSector("communication")).toBe("Communication");
    expect(formatSector("energy")).toBe("Energy");
  });

  it("preserves special-case labels verbatim", () => {
    expect(formatSector("Other")).toBe("Other");
    expect(formatSector("Unclassified")).toBe("Unclassified");
    expect(formatSector("Smaller Sectors")).toBe("Smaller Sectors");
  });

  it("returns 'Unclassified' for null, undefined, or empty string", () => {
    expect(formatSector(null)).toBe("Unclassified");
    expect(formatSector(undefined)).toBe("Unclassified");
    expect(formatSector("")).toBe("Unclassified");
  });

  it("handles mixed casing and extra whitespace", () => {
    expect(formatSector("CONSUMER_STAPLES")).toBe("Consumer Staples");
    expect(formatSector("Consumer_Staples")).toBe("Consumer Staples");
    expect(formatSector("real estate")).toBe("Real Estate");
    expect(formatSector("  real_estate  ")).toBe("Real Estate");
  });
});

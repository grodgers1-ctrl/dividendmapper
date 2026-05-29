import { describe, it, expect } from "vitest";
import { classifySector, isRealEstate, isUtility, type Sector } from "../sector";

describe("classifySector", () => {
  it("classifies REIT industries as real_estate", () => {
    expect(classifySector("REIT - Diversified")).toBe("real_estate");
    expect(classifySector("REIT - Residential")).toBe("real_estate");
    expect(classifySector("Real Estate Services")).toBe("real_estate");
  });

  it("classifies utility industries as utility", () => {
    expect(classifySector("Utilities - Regulated Electric")).toBe("utility");
    expect(classifySector("Utilities - Diversified")).toBe("utility");
  });

  it("classifies financial industries as financial", () => {
    expect(classifySector("Banks - Diversified")).toBe("financial");
    expect(classifySector("Insurance - Life")).toBe("financial");
  });

  it("classifies energy industries as energy", () => {
    expect(classifySector("Oil & Gas Integrated")).toBe("energy");
  });

  it("falls back to other for unrecognised industries", () => {
    expect(classifySector("Some New Sector")).toBe("other");
    expect(classifySector(null)).toBe("other");
    expect(classifySector("")).toBe("other");
  });

  it("isRealEstate / isUtility convenience helpers", () => {
    expect(isRealEstate("real_estate" as Sector)).toBe(true);
    expect(isRealEstate("utility" as Sector)).toBe(false);
    expect(isUtility("utility" as Sector)).toBe(true);
    expect(isUtility("other" as Sector)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { classifySector, isRealEstate, isUtility, isFinancial, type Sector } from "../sector";

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

  it("classifies Consumer Electronics as technology (AAPL, megacap hardware)", () => {
    expect(classifySector("Consumer Electronics")).toBe("technology");
  });

  it("classifies Information Technology Services as technology (WISE.L et al)", () => {
    expect(classifySector("Information Technology Services")).toBe("technology");
  });

  it("classifies Discount Stores as consumer_discretionary (BME.L)", () => {
    expect(classifySector("Discount Stores")).toBe("consumer_discretionary");
  });

  it("classifies Department Stores as consumer_discretionary", () => {
    expect(classifySector("Department Stores")).toBe("consumer_discretionary");
  });

  it("classifies Grocery Stores as consumer_staples (Tesco/Sainsbury's pattern)", () => {
    expect(classifySector("Grocery Stores")).toBe("consumer_staples");
  });
});

describe("isFinancial", () => {
  it("is true for bank/insurer/asset-manager industries", () => {
    expect(isFinancial(classifySector("Insurance - Life"))).toBe(true);
    expect(isFinancial(classifySector("Banks - Diversified"))).toBe(true);
    expect(isFinancial(classifySector("Asset Management"))).toBe(true);
  });
  it("is false for non-financials", () => {
    expect(isFinancial(classifySector("Drug Manufacturers"))).toBe(false);
    expect(isFinancial(classifySector("Utilities - Regulated"))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { computeCU2GeoScope, geographicScopeFor } from "../c_u2-geo-scope";

describe("computeCU2GeoScope", () => {
  it("uk_only scores 50", () => {
    expect(computeCU2GeoScope({ geographicScope: "uk_only" }).score).toBe(50);
  });

  it("overseas_exposed scores 75", () => {
    expect(computeCU2GeoScope({ geographicScope: "overseas_exposed" }).score).toBe(75);
  });

  it("unknown scope returns null (cascade)", () => {
    expect(computeCU2GeoScope({ geographicScope: "" }).score).toBeNull();
    expect(computeCU2GeoScope({ geographicScope: "global" }).score).toBeNull();
  });
});

describe("geographicScopeFor", () => {
  it("returns the classified scope for a known ticker", () => {
    expect(geographicScopeFor("BLND.L")).toBe("uk_only");
    expect(geographicScopeFor("SGRO.L")).toBe("overseas_exposed");
  });

  it("returns null for unknown tickers", () => {
    expect(geographicScopeFor("UNKNOWN.L")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { isBeta, isAdmin, BETA_UNTIL } from "../config";

describe("isBeta", () => {
  it("is true before BETA_UNTIL", () => {
    expect(isBeta(new Date("2026-06-01T00:00:00Z"))).toBe(true);
  });

  it("is false on/after BETA_UNTIL", () => {
    expect(isBeta(new Date(BETA_UNTIL.getTime() + 1000))).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true for an allowlisted email (case-insensitive)", () => {
    expect(isAdmin("Glenn@DividendMapper.com")).toBe(true);
  });

  it("returns false for a non-admin email and for null", () => {
    expect(isAdmin("someone@example.com")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

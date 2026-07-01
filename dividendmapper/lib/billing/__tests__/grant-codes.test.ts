import { describe, it, expect } from "vitest";

import { generateGrantCode } from "../grant-codes";

describe("generateGrantCode", () => {
  it("returns a <SLUG>-<6 char suffix> shape from the email local part", () => {
    const code = generateGrantCode("glenn@dividendmapper.com");
    expect(code).toMatch(/^GLENN-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it("uppercases and strips non-alphanumerics from the slug", () => {
    const code = generateGrantCode("jo.smith+promo@x.com");
    // "jo.smith+promo" → "JOSMITHPRO" (uppercased, alnum only, max 10 chars)
    expect(code).toMatch(/^JOSMITHPRO-[A-Z0-9]{6}$/);
  });

  it("falls back to MEMBER when the local part has no alphanumerics", () => {
    const code = generateGrantCode("+++@x.com");
    expect(code).toMatch(/^MEMBER-[A-Z0-9]{6}$/);
  });

  it("produces distinct suffixes across calls", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => generateGrantCode("glenn@x.com")),
    );
    // Collisions across 50 draws from a 31^6 space are astronomically unlikely.
    expect(codes.size).toBe(50);
  });
});

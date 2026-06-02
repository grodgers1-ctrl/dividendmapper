import { describe, it, expect } from "vitest";
import { normalizeTicker } from "../load-score";

describe("normalizeTicker", () => {
  it("uppercases and trims a valid ticker", () => {
    expect(normalizeTicker(" pep ")).toBe("PEP");
    expect(normalizeTicker("vod.l")).toBe("VOD.L");
  });

  it("decodes percent-encoding before validating", () => {
    expect(normalizeTicker("vod%2El")).toBe("VOD.L");
  });

  it("rejects path-traversal and illegal characters", () => {
    expect(normalizeTicker("../etc")).toBeNull();
    expect(normalizeTicker("AB CD")).toBeNull();
    expect(normalizeTicker("")).toBeNull();
  });

  it("rejects an over-long ticker", () => {
    expect(normalizeTicker("ABCDEFGHIJKLM")).toBeNull(); // 13 chars
  });

  it("returns null on malformed percent-encoding instead of throwing", () => {
    expect(normalizeTicker("%")).toBeNull();
  });
});

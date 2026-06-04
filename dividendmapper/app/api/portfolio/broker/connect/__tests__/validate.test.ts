import { describe, it, expect } from "vitest";
import { validateConnectBody } from "@/app/api/portfolio/broker/connect/validate";

describe("validateConnectBody", () => {
  it("accepts a well-formed ISA connect body and trims the credentials", () => {
    const r = validateConnectBody({ apiKey: "  key123 ", apiSecret: " secret456 ", wrapper: "isa" });
    expect(r).toEqual({ ok: true, value: { apiKey: "key123", apiSecret: "secret456", wrapper: "isa" } });
  });

  it("accepts gia (Invest)", () => {
    const r = validateConnectBody({ apiKey: "k", apiSecret: "s", wrapper: "gia" });
    expect(r.ok).toBe(true);
  });

  it("rejects a non-T212 wrapper (e.g. sipp — no API)", () => {
    expect(validateConnectBody({ apiKey: "k", apiSecret: "s", wrapper: "sipp" })).toEqual({
      ok: false,
      error: "invalid_wrapper",
    });
  });

  it("rejects missing key or secret", () => {
    expect(validateConnectBody({ apiKey: "", apiSecret: "s", wrapper: "isa" })).toEqual({
      ok: false,
      error: "missing_credentials",
    });
    expect(validateConnectBody({ apiKey: "k", wrapper: "isa" })).toEqual({
      ok: false,
      error: "missing_credentials",
    });
  });

  it("rejects non-object input", () => {
    expect(validateConnectBody(null).ok).toBe(false);
    expect(validateConnectBody("nope").ok).toBe(false);
  });
});

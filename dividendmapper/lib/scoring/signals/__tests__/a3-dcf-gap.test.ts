import { describe, it, expect } from "vitest";
import { computeA3DcfGap } from "../a3-dcf-gap";

describe("computeA3DcfGap", () => {
  it("returns 100 when intrinsic is 50%+ above price", () => {
    const r = computeA3DcfGap({ intrinsic: 150, price: 100, isUs: true });
    expect(r.score).toBe(100);
  });

  it("returns 0 when intrinsic is 50%+ below price", () => {
    const r = computeA3DcfGap({ intrinsic: 50, price: 100, isUs: true });
    expect(r.score).toBe(0);
  });

  it("returns 50 at parity", () => {
    const r = computeA3DcfGap({ intrinsic: 100, price: 100, isUs: true });
    expect(r.score).toBe(50);
  });

  it("scales gap linearly between bounds", () => {
    const r = computeA3DcfGap({ intrinsic: 110, price: 100, isUs: true });
    expect(r.score).toBe(60);
  });

  it("marks softSignal=true when isUs=false (non-US tickers)", () => {
    const r = computeA3DcfGap({ intrinsic: 110, price: 100, isUs: false });
    expect(r.softSignal).toBe(true);
  });

  it("marks softSignal=false for US tickers", () => {
    const r = computeA3DcfGap({ intrinsic: 110, price: 100, isUs: true });
    expect(r.softSignal).toBe(false);
  });

  it("returns N/A when intrinsic is 0 or negative", () => {
    const r = computeA3DcfGap({ intrinsic: 0, price: 100, isUs: true });
    expect(r.score).toBeNull();
  });

  it("returns N/A when price is 0", () => {
    const r = computeA3DcfGap({ intrinsic: 100, price: 0, isUs: true });
    expect(r.score).toBeNull();
  });
});

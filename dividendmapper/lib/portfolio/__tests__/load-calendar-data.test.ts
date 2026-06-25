import { describe, it, expect } from "vitest";
import { inferExDivNativeCurrency } from "../ex-div-currency";

describe("inferExDivNativeCurrency", () => {
  it("returns GBp for .L tickers (LSE)", () => {
    expect(inferExDivNativeCurrency("PHP.L")).toBe("GBp");
    expect(inferExDivNativeCurrency("BATS.L")).toBe("GBp");
    expect(inferExDivNativeCurrency("ULVR.L")).toBe("GBp");
  });

  it("is case-insensitive on the .L suffix", () => {
    expect(inferExDivNativeCurrency("php.l")).toBe("GBp");
    expect(inferExDivNativeCurrency("Php.L")).toBe("GBp");
  });

  it("returns USD for US tickers (no suffix)", () => {
    expect(inferExDivNativeCurrency("AAPL")).toBe("USD");
    expect(inferExDivNativeCurrency("MAIN")).toBe("USD");
    expect(inferExDivNativeCurrency("ARCC")).toBe("USD");
  });

  it("regression: PHP.L forecast at 1.98 pence × 50 shares should be £0.99, not £99", () => {
    // Bug repro: when the loader used holdings.cost_currency ('GBP' for a
    // UK holding) the GBP→GBP rate of 1.0 applied to a pence value (1.98)
    // gave £99 for 50 shares — a 100x inflation. The fix infers 'GBp' from
    // the ticker suffix so 1.98 GBp × 0.01 × 50 = £0.99.
    const currency = inferExDivNativeCurrency("PHP.L");
    const ratesToGbp = { GBp: 0.01, GBP: 1, USD: 0.79 };
    const perSharePounds = 1.98 * ratesToGbp[currency as keyof typeof ratesToGbp];
    const forecastFor50Shares = perSharePounds * 50;
    expect(forecastFor50Shares).toBeCloseTo(0.99, 2);
    expect(forecastFor50Shares).not.toBeCloseTo(99, 2);
  });
});

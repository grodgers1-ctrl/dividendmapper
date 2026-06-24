import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { LeverageGauge } from "../leverage-gauge";

function html(value: number | null, mode: "ffo-payout" | "nii-coverage" | "ltv" = "ffo-payout", label = "test") {
  return renderToString(
    <LeverageGauge mode={mode} value={value} label={label} />,
  );
}

describe("LeverageGauge", () => {
  it("renders an em-dash and the unavailable aria-label when value is null", () => {
    const out = html(null);
    expect(out).toContain("—");
    expect(out).toContain("data unavailable");
  });

  it("renders an SVG when value is finite", () => {
    const out = html(75);
    expect(out).toContain("<svg");
    expect(out).toContain("FFO payout ratio");
  });

  it("uses the NII coverage title in nii-coverage mode", () => {
    const out = html(80, "nii-coverage", "NII covers regular dividend 1.33×");
    expect(out).toContain("NII coverage");
    expect(out).toContain("NII covers regular dividend 1.33×");
  });

  it("uses the LTV title in ltv mode", () => {
    const out = html(60, "ltv", "LTV 33.2%");
    expect(out).toContain("Loan-to-value");
    expect(out).toContain("LTV 33.2%");
  });

  it("selects resilience-1 (brick) for the lowest band", () => {
    const out = html(10);
    expect(out).toContain("--color-resilience-1");
  });

  it("selects resilience-5 (petrol) for the highest band", () => {
    const out = html(95);
    expect(out).toContain("--color-resilience-5");
  });

  it("selects resilience-3 (sand) for the middle band", () => {
    const out = html(60);
    expect(out).toContain("--color-resilience-3");
  });

  it("clamps out-of-range values without crashing", () => {
    const lo = html(-10);
    const hi = html(150);
    expect(lo).toContain("<svg");
    expect(hi).toContain("<svg");
  });
});

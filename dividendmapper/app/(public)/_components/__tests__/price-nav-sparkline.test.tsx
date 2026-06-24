import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { PriceNavSparkline } from "../price-nav-sparkline";

function mkHistory(n: number, base = 1.0): { observed_at: string; price_nav_ratio: number | null }[] {
  const out: { observed_at: string; price_nav_ratio: number | null }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      observed_at: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
      price_nav_ratio: base + Math.sin(i / 5) * 0.05,
    });
  }
  return out;
}

describe("PriceNavSparkline", () => {
  it("renders fallback text when fewer than 8 valid observations", () => {
    const out = renderToString(<PriceNavSparkline history={mkHistory(3)} />);
    expect(out).toContain("Insufficient price history");
  });

  it("renders fallback text on empty history", () => {
    const out = renderToString(<PriceNavSparkline history={[]} />);
    expect(out).toContain("Insufficient price history");
  });

  it("renders an SVG with a line path when ≥ 8 observations", () => {
    const out = renderToString(<PriceNavSparkline history={mkHistory(60, 1.1)} />);
    expect(out).toContain("<svg");
    expect(out).toContain("<path");
    // The sparkline shows the LAST observation as the headline number.
    expect(out).toMatch(/<p[^>]+>[0-9]\.[0-9]{2}<!-- -->×<\/p>/);
    expect(out).toContain("σ vs the rolling mean");
  });

  it("counts only non-null observations toward the 8-row floor", () => {
    const history = mkHistory(10).map((p, i) =>
      i % 2 === 0 ? p : { ...p, price_nav_ratio: null },
    );
    // 5 valid observations → still below the 8 floor.
    const out = renderToString(<PriceNavSparkline history={history} />);
    expect(out).toContain("Insufficient price history");
  });
});

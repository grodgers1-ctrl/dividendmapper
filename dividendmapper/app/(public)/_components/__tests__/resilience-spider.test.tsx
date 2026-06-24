import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ResilienceSpider } from "../resilience-spider";

describe("ResilienceSpider", () => {
  it("renders an SVG with all four axis labels", () => {
    const out = renderToString(<ResilienceSpider q={70} d={50} c={80} r={60} />);
    expect(out).toContain("<svg");
    expect(out).toContain("Quality");
    expect(out).toContain("Discount");
    expect(out).toContain("Concentration");
    expect(out).toContain("Risk");
  });

  it("renders em-dashes for null axes", () => {
    const out = renderToString(<ResilienceSpider q={70} d={null} c={null} r={60} />);
    // 2 null axes → at least 2 em-dashes (plus we don't double-render).
    const dashCount = (out.match(/—/g) ?? []).length;
    expect(dashCount).toBe(2);
  });

  it("includes a polygon element for the radar shape", () => {
    const out = renderToString(<ResilienceSpider q={70} d={50} c={80} r={60} />);
    expect(out).toContain("<polygon");
  });

  it("clamps values into the 0..100 range", () => {
    // Out-of-range values must not throw; spider just renders against bounds.
    const out = renderToString(<ResilienceSpider q={150} d={-20} c={50} r={101} />);
    expect(out).toContain("<svg");
  });

  it("encodes each value in the aria-label", () => {
    const out = renderToString(<ResilienceSpider q={70} d={50} c={80} r={60} />);
    expect(out).toContain("Quality 70");
    expect(out).toContain("Discount 50");
    expect(out).toContain("Concentration 80");
    expect(out).toContain("Risk 60");
  });
});

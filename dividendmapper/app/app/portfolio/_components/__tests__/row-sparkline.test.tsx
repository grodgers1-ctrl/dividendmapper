import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RowSparkline } from "../row-sparkline";

const baseSeries = { firstClose: 100, lastClose: 110, currency: "USD" };

describe("RowSparkline", () => {
  it("renders the Collecting pill when fewer than 8 points", () => {
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points: [100, 102, 104] }}
      />,
    );
    expect(container.textContent).toContain("Collecting");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the Collecting pill when series is null", () => {
    const { container } = render(
      <RowSparkline ticker="AAPL" name="Apple" range="30D" series={null} />,
    );
    expect(container.textContent).toContain("Collecting");
  });

  it("renders an SVG path with M…L… for >= 8 points", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points, lastClose: 129 }}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const path = svg!.querySelector("path:last-of-type");
    expect(path?.getAttribute("d")?.startsWith("M ")).toBe(true);
    expect(path?.getAttribute("d")).toContain(" L ");
  });

  it("places the last-point dot at the right edge", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points }}
      />,
    );
    const circle = container.querySelector("circle");
    const cx = Number(circle?.getAttribute("cx") ?? 0);
    expect(cx).toBeGreaterThan(115); // viewBox width is 120
  });

  it("renders a horizontal line for an all-flat series", () => {
    const points = Array.from({ length: 30 }, () => 100);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points, firstClose: 100, lastClose: 100 }}
      />,
    );
    const path = container.querySelector("path:last-of-type");
    const ys = (path?.getAttribute("d") ?? "")
      .split(/[ML]/)
      .filter((s) => s.trim().length > 0)
      .map((p) => Number(p.trim().split(/\s+/)[1]));
    const unique = new Set(ys.map((y) => Math.round(y)));
    expect(unique.size).toBe(1);
  });

  it("includes an aria-label with ticker + range + last-close", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="1Y"
        series={{ ...baseSeries, points, lastClose: 129 }}
      />,
    );
    const label = container.querySelector("[role='img']")?.getAttribute("aria-label") ?? "";
    expect(label).toContain("AAPL");
    expect(label).toContain("1Y");
    expect(label).toContain("129");
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { RidgeSparkline } from "@/app/app/dashboard/_components/RidgeSparkline";

afterEach(cleanup);

function fixedSeries() {
  return [
    { at: new Date("2026-01-01"), value: 100 },
    { at: new Date("2026-02-01"), value: 120 },
    { at: new Date("2026-03-01"), value: 110 },
    { at: new Date("2026-04-01"), value: 140 },
    { at: new Date("2026-05-01"), value: 170 },
    { at: new Date("2026-06-01"), value: 165 },
  ];
}

describe("RidgeSparkline", () => {
  it("renders nothing visible when the data series is empty", () => {
    const { container } = render(<RidgeSparkline data={[]} />);
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelectorAll("circle").length).toBe(0);
  });

  it("renders a single point as a dot marker", () => {
    const { container } = render(
      <RidgeSparkline data={[{ at: new Date("2026-01-01"), value: 100 }]} />,
    );
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the main line path in var(--brand)", () => {
    const { container } = render(<RidgeSparkline data={fixedSeries()} />);
    const paths = Array.from(container.querySelectorAll("path"));
    const main = paths.find((p) => p.getAttribute("stroke") === "var(--brand)");
    expect(main).toBeTruthy();
    expect(main?.getAttribute("d")).toMatch(/^M/);
  });

  it("renders at least two contour lines below the main line", () => {
    const { container } = render(<RidgeSparkline data={fixedSeries()} />);
    const paths = Array.from(container.querySelectorAll("path"));
    // main + 2-3 contour copies => at least 3
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic for a fixed input series", () => {
    const series = fixedSeries();
    const first = render(<RidgeSparkline data={series} />);
    const firstHtml = first.container.innerHTML;
    cleanup();
    const second = render(<RidgeSparkline data={series} />);
    expect(second.container.innerHTML).toBe(firstHtml);
  });
});

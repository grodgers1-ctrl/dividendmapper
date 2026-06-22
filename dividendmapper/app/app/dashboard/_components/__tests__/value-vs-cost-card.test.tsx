import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ValueVsCostCard } from "@/app/app/dashboard/_components/ValueVsCostCard";

afterEach(cleanup);

describe("<ValueVsCostCard>", () => {
  it("renders the eyebrow 'Value vs cost'", () => {
    render(<ValueVsCostCard valueGbp={1100} costGbp={1000} />);
    expect(screen.getByText(/value vs cost/i)).toBeTruthy();
  });

  it("renders a positive P/L figure with positive tone when value > cost", () => {
    const { container } = render(<ValueVsCostCard valueGbp={1200} costGbp={1000} />);
    const pl = container.querySelector(".text-positive");
    expect(pl?.textContent ?? "").toContain("+");
    expect(pl?.textContent ?? "").toContain("£200");
    expect(pl?.textContent ?? "").toContain("20.0");
  });

  it("renders a negative P/L figure with negative tone when value < cost", () => {
    const { container } = render(<ValueVsCostCard valueGbp={800} costGbp={1000} />);
    const pl = container.querySelector(".text-negative");
    expect(pl?.textContent ?? "").toContain("−");
    expect(pl?.textContent ?? "").toContain("£200");
    expect(pl?.textContent ?? "").toContain("20.0");
  });

  it("renders the value · cost basis subline", () => {
    render(<ValueVsCostCard valueGbp={1200} costGbp={1000} />);
    expect(screen.getByText(/£1,200/)).toBeTruthy();
    expect(screen.getByText(/£1,000/)).toBeTruthy();
  });

  it("places the diverging bar with left:50% for positive P/L", () => {
    const { container } = render(<ValueVsCostCard valueGbp={1100} costGbp={1000} />);
    const bar = container.querySelector("[data-testid='value-vs-cost-bar']") as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar?.style.left).toBe("50%");
  });

  it("places the diverging bar with left<50% for negative P/L", () => {
    const { container } = render(<ValueVsCostCard valueGbp={900} costGbp={1000} />);
    const bar = container.querySelector("[data-testid='value-vs-cost-bar']") as HTMLElement | null;
    expect(bar).toBeTruthy();
    const leftPct = parseFloat(bar?.style.left ?? "0");
    expect(leftPct).toBeLessThan(50);
  });

  it("saturates the bar width at 50% when P/L exceeds +50%", () => {
    const { container } = render(<ValueVsCostCard valueGbp={3000} costGbp={1000} />);
    const bar = container.querySelector("[data-testid='value-vs-cost-bar']") as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar?.style.width).toBe("50%");
  });

  it("renders an empty-state when costGbp is 0", () => {
    render(<ValueVsCostCard valueGbp={1000} costGbp={0} />);
    expect(screen.getByText(/cost basis collecting/i)).toBeTruthy();
  });

  it("renders an empty-state when costGbp is negative", () => {
    render(<ValueVsCostCard valueGbp={1000} costGbp={-10} />);
    expect(screen.getByText(/cost basis collecting/i)).toBeTruthy();
  });
});

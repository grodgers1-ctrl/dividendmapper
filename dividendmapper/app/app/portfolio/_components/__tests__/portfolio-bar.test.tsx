import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PortfolioBar, percentOfPortfolio } from "../portfolio-bar";

describe("percentOfPortfolio", () => {
  it("returns 0 when total is zero", () => {
    expect(percentOfPortfolio(100, 0)).toBe(0);
  });
  it("returns the ratio when total > 0", () => {
    expect(percentOfPortfolio(50, 200)).toBeCloseTo(0.25);
  });
  it("caps at 1 when value exceeds total", () => {
    expect(percentOfPortfolio(300, 200)).toBe(1);
  });
});

describe("PortfolioBar", () => {
  it("renders nothing when totalValue is zero", () => {
    const { container } = render(<PortfolioBar value={100} totalValue={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a positioned span with the right width %", () => {
    const { container } = render(<PortfolioBar value={50} totalValue={200} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("25%");
  });

  it("renders a tooltip showing the rounded percent", () => {
    const { container } = render(<PortfolioBar value={50} totalValue={200} />);
    expect((container.firstChild as HTMLElement).title).toBe("25% of visible portfolio value");
  });
});

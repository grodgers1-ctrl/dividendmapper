import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { PositionCard } from "@/app/app/portfolio/[ticker]/_components/PositionCard";

afterEach(cleanup);

describe("<PositionCard>", () => {
  it("renders the position value with currency", () => {
    render(
      <PositionCard
        quantity={10}
        avgCost={150}
        costCurrency="USD"
        valueAmount={2000}
        valueCurrency="USD"
        wrapper="brokerage"
      />,
    );
    // 10 × $200/share = $2,000 — the page does the math; the card just renders.
    expect(screen.getByText(/\$2,000/)).toBeInTheDocument();
  });

  it("renders the wrapper label", () => {
    render(
      <PositionCard
        quantity={10}
        avgCost={150}
        costCurrency="USD"
        valueAmount={2000}
        valueCurrency="USD"
        wrapper="isa"
      />,
    );
    expect(screen.getByText(/ISA/i)).toBeInTheDocument();
  });

  it("renders quantity and avg cost", () => {
    render(
      <PositionCard
        quantity={12}
        avgCost={150}
        costCurrency="USD"
        valueAmount={2000}
        valueCurrency="USD"
        wrapper="brokerage"
      />,
    );
    expect(screen.getByText(/12\b/)).toBeInTheDocument();
    expect(screen.getByText(/\$150/)).toBeInTheDocument();
  });

  it("shows a positive unrealised P/L with up arrow", () => {
    const { container } = render(
      <PositionCard
        quantity={10}
        avgCost={150}
        costCurrency="USD"
        valueAmount={2000}
        valueCurrency="USD"
        wrapper="brokerage"
      />,
    );
    // cost = 10 × 150 = $1,500 ; value = $2,000 ; P/L = +$500 (+33.3%)
    const pnl = container.querySelector(".text-positive")?.textContent ?? "";
    expect(pnl).toContain("+");
    expect(pnl).toContain("$500");
    expect(pnl).toContain("33.3");
    expect(pnl).toContain("↑");
  });

  it("shows a negative unrealised P/L when value is below cost", () => {
    const { container } = render(
      <PositionCard
        quantity={10}
        avgCost={150}
        costCurrency="USD"
        valueAmount={1200}
        valueCurrency="USD"
        wrapper="brokerage"
      />,
    );
    const pnl = container.querySelector(".text-negative")?.textContent ?? "";
    expect(pnl).toContain("−");
    expect(pnl).toContain("$300");
    expect(pnl).toContain("↓");
  });

  it("renders a no-data fallback when value is null", () => {
    render(
      <PositionCard
        quantity={10}
        avgCost={150}
        costCurrency="USD"
        valueAmount={null}
        valueCurrency={null}
        wrapper="brokerage"
      />,
    );
    expect(screen.getByText(/no recent price/i)).toBeInTheDocument();
  });
});

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

  describe("cross-currency P/L", () => {
    it("computes P/L in cost currency when ratesToGbp covers both sides", () => {
      // Cost: 10 × £100 = £1,000 GBP
      // Value: $1,500 USD × 0.80 / 1 = £1,200 GBP-equivalent
      // P/L: +£200 (+20.0%)
      const { container } = render(
        <PositionCard
          quantity={10}
          avgCost={100}
          costCurrency="GBP"
          valueAmount={1500}
          valueCurrency="USD"
          wrapper="isa"
          ratesToGbp={{ GBP: 1, USD: 0.8 }}
        />,
      );
      const pnl = container.querySelector(".text-positive")?.textContent ?? "";
      expect(pnl).toContain("+");
      expect(pnl).toContain("£200");
      expect(pnl).toContain("20.0");
      expect(pnl).toContain("↑");
    });

    it("shows a negative cross-currency P/L when FX makes the position underwater", () => {
      // Cost: 10 × $200 = $2,000 USD
      // Value: £1,200 GBP × 1 / 0.80 = $1,500 USD-equivalent
      // P/L: −$500 (−25.0%)
      const { container } = render(
        <PositionCard
          quantity={10}
          avgCost={200}
          costCurrency="USD"
          valueAmount={1200}
          valueCurrency="GBP"
          wrapper="brokerage"
          ratesToGbp={{ GBP: 1, USD: 0.8 }}
        />,
      );
      const pnl = container.querySelector(".text-negative")?.textContent ?? "";
      expect(pnl).toContain("−");
      expect(pnl).toContain("$500");
      expect(pnl).toContain("25.0");
      expect(pnl).toContain("↓");
    });

    it("notes the FX-as-of-now caveat under a cross-currency P/L", () => {
      render(
        <PositionCard
          quantity={10}
          avgCost={100}
          costCurrency="GBP"
          valueAmount={1500}
          valueCurrency="USD"
          wrapper="isa"
          ratesToGbp={{ GBP: 1, USD: 0.8 }}
        />,
      );
      expect(screen.getByText(/fx.*today/i)).toBeInTheDocument();
    });

    it("falls back to the unavailable message when a needed rate is missing", () => {
      render(
        <PositionCard
          quantity={10}
          avgCost={100}
          costCurrency="GBP"
          valueAmount={1500}
          valueCurrency="USD"
          wrapper="isa"
          ratesToGbp={{ GBP: 1 }} // USD rate missing
        />,
      );
      expect(screen.getByText(/p\/l unavailable/i)).toBeInTheDocument();
    });

    it("does not show the FX note for same-currency P/L", () => {
      render(
        <PositionCard
          quantity={10}
          avgCost={150}
          costCurrency="USD"
          valueAmount={2000}
          valueCurrency="USD"
          wrapper="brokerage"
          ratesToGbp={{ USD: 0.8, GBP: 1 }}
        />,
      );
      expect(screen.queryByText(/fx.*today/i)).toBeNull();
    });
  });
});

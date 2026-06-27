import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuickCheckStrip } from "../quick-check-strip";

describe("<QuickCheckStrip>", () => {
  it("renders all four cards with formatted values", () => {
    render(
      <QuickCheckStrip
        signals={{
          forwardYield: 0.0432,
          payoutRatio: 0.65,
          fcfCoverage: 1.8,
          dividendCagr5y: 0.078,
        }}
      />,
    );
    expect(screen.getByText("Forward yield")).toBeInTheDocument();
    expect(screen.getByText("4.32%")).toBeInTheDocument();
    expect(screen.getByText("Payout ratio")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("FCF coverage")).toBeInTheDocument();
    expect(screen.getByText("1.80x")).toBeInTheDocument();
    expect(screen.getByText("5-year growth")).toBeInTheDocument();
    expect(screen.getByText("7.8%")).toBeInTheDocument();
  });

  it("renders '—' for any null metric", () => {
    render(
      <QuickCheckStrip
        signals={{
          forwardYield: null,
          payoutRatio: null,
          fcfCoverage: null,
          dividendCagr5y: null,
        }}
      />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(4);
  });

  it("renders info popovers (accessible by label)", () => {
    render(
      <QuickCheckStrip
        signals={{ forwardYield: 0.03, payoutRatio: 0.5, fcfCoverage: 2, dividendCagr5y: 0.05 }}
      />,
    );
    expect(screen.getByRole("button", { name: /forward yield/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /payout ratio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fcf coverage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5-year growth/i })).toBeInTheDocument();
  });
});

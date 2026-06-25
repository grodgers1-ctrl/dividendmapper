import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrilldownPanel } from "../drilldown-panel";

describe("DrilldownPanel", () => {
  it("renders one row per payment with ticker, dates, native + primary, wrapper badge", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[
          {
            ticker: "PHP.L",
            exDate: "2026-07-02",
            payDate: "2026-07-09",
            nativeAmount: 42,
            nativeCurrency: "GBp",
            primaryAmount: 0.42,
            wrapper: "isa",
            confidence: "confirmed",
          },
          {
            ticker: "O",
            exDate: "2026-07-11",
            payDate: "2026-07-15",
            nativeAmount: 0.265,
            nativeCurrency: "USD",
            primaryAmount: 0.21,
            wrapper: "gia",
            confidence: "confirmed",
          },
        ]}
      />,
    );
    expect(screen.getByText("PHP.L")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
    const isaBadge = screen.getByText(/ISA/);
    expect(isaBadge).toHaveAttribute("data-wrapper-class", "sheltered");
    const giaBadge = screen.getByText(/GIA/);
    expect(giaBadge).toHaveAttribute("data-wrapper-class", "taxable");
  });

  it("empty state for 'no-announcement' shows the right copy", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[]}
        emptyReason="no-announcement"
      />,
    );
    expect(screen.getByText(/no announcement yet/i)).toBeInTheDocument();
  });

  it("empty state for 'non-paying' shows the right copy", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[]}
        emptyReason="non-paying"
      />,
    );
    expect(screen.getByText(/doesn't pay a dividend/i)).toBeInTheDocument();
  });
});

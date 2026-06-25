import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrilldownPanel } from "../drilldown-panel";

describe("DrilldownPanel", () => {
  it("renders one row per payment with ticker, dates, per-share native + total primary, wrapper badge", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[
          {
            ticker: "PHP.L",
            exDate: "2026-07-02",
            payDate: "2026-07-09",
            nativeAmount: 1.98,        // per-share in pence
            nativeCurrency: "GBp",
            quantity: 50,
            primaryAmount: 0.99,        // 1.98p × 50 × 0.01
            wrapper: "isa",
            confidence: "confirmed",
          },
          {
            ticker: "O",
            exDate: "2026-07-11",
            payDate: "2026-07-15",
            nativeAmount: 0.265,
            nativeCurrency: "USD",
            quantity: 30,
            primaryAmount: 6.28,
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

  it("renders per-share native amount + quantity multiplier + total primary (regression for the £99 bug)", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[
          {
            ticker: "PHP.L",
            exDate: "2026-07-02",
            payDate: "2026-07-09",
            nativeAmount: 1.98,
            nativeCurrency: "GBp",
            quantity: 50,
            primaryAmount: 0.99,
            wrapper: "isa",
            confidence: "confirmed",
          },
        ]}
      />,
    );
    // Per-share unit on the left ("1.98 GBp"), quantity multiplier ("× 50"),
    // total on the right ("£0.99"). NOT "99.00 GBP £99.00" like Slice A.
    expect(screen.getByText(/1\.98 GBp/)).toBeInTheDocument();
    expect(screen.getByText(/× 50/)).toBeInTheDocument();
    expect(screen.getByText(/£0\.99/)).toBeInTheDocument();
    expect(screen.queryByText(/99\.00 GBP/)).toBeNull();
    expect(screen.queryByText(/£99\.00/)).toBeNull();
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

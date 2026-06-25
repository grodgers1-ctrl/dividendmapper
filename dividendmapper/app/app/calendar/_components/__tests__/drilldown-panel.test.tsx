import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrilldownPanel } from "../drilldown-panel";
import type { IncomeCalendarPayment } from "@/lib/portfolio/income-calendar";

describe("DrilldownPanel", () => {
  it("renders a row per payment with ticker, name, native math, primary, freq+status, wrapper", () => {
    const payments: IncomeCalendarPayment[] = [
      {
        ticker: "PHP.L",
        name: "Primary Health Properties",
        exDate: "2026-07-02",
        payDate: "2026-07-09",
        perShareNative: 1.98,
        nativeCurrency: "GBp",
        quantity: 50,
        primaryAmount: 0.99,
        wrapper: "isa",
        status: "declared",
        frequency: "quarterly",
      },
      {
        ticker: "O",
        name: "Realty Income Corporation",
        exDate: "2026-07-11",
        payDate: "2026-07-15",
        perShareNative: 0.265,
        nativeCurrency: "USD",
        quantity: 30,
        primaryAmount: 6.28,
        wrapper: "gia",
        status: "estimated",
        frequency: "monthly",
      },
    ];
    render(<DrilldownPanel primaryCurrency="GBP" payments={payments} />);
    expect(screen.getByText("PHP.L")).toBeInTheDocument();
    expect(screen.getByText("Primary Health Properties")).toBeInTheDocument();
    expect(screen.getByText(/1\.98 GBp/)).toBeInTheDocument();
    expect(screen.getByText(/× 50/)).toBeInTheDocument();
    expect(screen.getByText(/£0\.99/)).toBeInTheDocument();
  });

  it("renders the Frequency pill from cron-cached cadence", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[
          {
            ticker: "PHP.L",
            exDate: "2026-07-02",
            payDate: "2026-07-09",
            perShareNative: 1.98,
            nativeCurrency: "GBp",
            quantity: 50,
            primaryAmount: 0.99,
            wrapper: "isa",
            status: "declared",
            frequency: "quarterly",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("drilldown-frequency")).toHaveTextContent(/quarterly/i);
  });

  it("renders the Status pill (Received / Declared / Estimated) on each row", () => {
    const base = {
      ticker: "AAPL",
      exDate: "2026-07-02",
      payDate: "2026-07-09",
      perShareNative: 0.24,
      nativeCurrency: "USD",
      quantity: 20,
      primaryAmount: 3.79,
      wrapper: "gia" as const,
    };
    const payments: IncomeCalendarPayment[] = [
      { ...base, status: "received" },
      { ...base, exDate: "2026-07-09", status: "declared" },
      { ...base, exDate: "2026-07-16", status: "estimated" },
    ];
    render(<DrilldownPanel primaryCurrency="GBP" payments={payments} />);
    const statusPills = screen.getAllByTestId("drilldown-status");
    expect(statusPills[0]).toHaveAttribute("data-status", "received");
    expect(statusPills[1]).toHaveAttribute("data-status", "declared");
    expect(statusPills[2]).toHaveAttribute("data-status", "estimated");
  });

  it("hides the × quantity multiplier when quantity is undefined (e.g. received row)", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[
          {
            ticker: "O",
            exDate: "2026-04-15",
            payDate: "2026-04-15",
            perShareNative: 7.95,
            nativeCurrency: "USD",
            primaryAmount: 6.28,
            wrapper: "gia",
            status: "received",
          },
        ]}
      />,
    );
    // The "× Qty" multiplier on the data row is absent. (Column header uses
    // "Per share × Qty" so we look for the actual " × <number>" pattern.)
    expect(screen.queryByText(/ × \d/)).toBeNull();
  });

  it("empty state with no announcement uses the cadence-aware copy", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[]}
        emptyReason="no-announcement"
      />,
    );
    expect(screen.getByText(/we'll fill it in/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarChart } from "../calendar-chart";
import type { IncomeCalendarMonth } from "@/lib/portfolio/income-calendar";

function bucket(ym: string, kind: IncomeCalendarMonth["kind"], primary: number): IncomeCalendarMonth {
  return {
    ym,
    segments: primary > 0 ? [{ kind, primary }] : [],
    gbp: primary,
    kind,
  };
}

describe("CalendarChart (Slice A)", () => {
  const months: IncomeCalendarMonth[] = [
    bucket("2025-12", "actual", 100),
    bucket("2026-01", "actual", 120),
    bucket("2026-02", "actual", 90),
    bucket("2026-03", "actual", 110),
    bucket("2026-04", "actual", 130),
    bucket("2026-05", "actual", 80),
    bucket("2026-06", "partial", 40),
    bucket("2026-07", "confirmed-forecast", 95),
    bucket("2026-08", "confirmed-forecast", 0),
    bucket("2026-09", "confirmed-forecast", 70),
    bucket("2026-10", "confirmed-forecast", 0),
    bucket("2026-11", "confirmed-forecast", 0),
    bucket("2026-12", "confirmed-forecast", 0),
    bucket("2027-01", "confirmed-forecast", 0),
    bucket("2027-02", "confirmed-forecast", 0),
    bucket("2027-03", "confirmed-forecast", 0),
    bucket("2027-04", "confirmed-forecast", 0),
    bucket("2027-05", "confirmed-forecast", 0),
    bucket("2027-06", "confirmed-forecast", 0),
  ];

  it("renders 19 month labels", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    expect(screen.getAllByTestId("calendar-month-label")).toHaveLength(19);
  });

  it("renders bars with correct data-kind on each", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    const bars = screen.getAllByTestId("calendar-bar-segment");
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.find((b) => b.getAttribute("data-kind") === "actual")).toBeTruthy();
    expect(bars.find((b) => b.getAttribute("data-kind") === "partial")).toBeTruthy();
    expect(bars.find((b) => b.getAttribute("data-kind") === "confirmed-forecast")).toBeTruthy();
  });

  it("renders the today divider with a `today` label badge after the partial month", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    const divider = screen.getByTestId("today-divider");
    expect(divider).toHaveTextContent(/today/i);
  });

  it("clicking a bar calls onSelectMonth with the YM", () => {
    const onSelect = vi.fn();
    render(<CalendarChart months={months} onSelectMonth={onSelect} />);
    const aprBar = screen.getByTestId("calendar-bar-2026-04");
    aprBar.click();
    expect(onSelect).toHaveBeenCalledWith("2026-04");
  });

  it("supports prefers-reduced-motion via a data-attribute the CSS keys on", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    expect(screen.getByTestId("calendar-chart-root")).toHaveAttribute("data-respect-reduced-motion", "true");
  });

  it("renders three y-axis ticks at 0, max/2 and max in the primary currency", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} primaryCurrency="GBP" />);
    // Max is 130 (Apr); ticks render at £130, £65, £0.
    expect(screen.getByTestId("calendar-y-tick-max")).toHaveTextContent("£130");
    expect(screen.getByTestId("calendar-y-tick-mid")).toHaveTextContent("£65");
    expect(screen.getByTestId("calendar-y-tick-zero")).toHaveTextContent("£0");
  });

  it("uses $ for the y-axis when primaryCurrency is USD", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} primaryCurrency="USD" />);
    expect(screen.getByTestId("calendar-y-tick-max")).toHaveTextContent("$130");
  });

  it("shows a tooltip with month + total on hover", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} primaryCurrency="GBP" />);
    expect(screen.queryByTestId("calendar-tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId("calendar-bar-2026-04"));
    const tooltip = screen.getByTestId("calendar-tooltip");
    expect(tooltip).toHaveTextContent(/Apr/);
    expect(screen.getByTestId("calendar-tooltip-total")).toHaveTextContent("£130");
    fireEvent.mouseLeave(screen.getByTestId("calendar-bar-2026-04"));
    expect(screen.queryByTestId("calendar-tooltip")).toBeNull();
  });

  it("renders projected-cadence + projected-growth segments with their kind on data-kind", () => {
    const projectedMonths: IncomeCalendarMonth[] = [
      { ym: "2026-08", gbp: 50, kind: "projected-cadence", segments: [{ kind: "projected-cadence", primary: 50 }] },
      { ym: "2026-09", gbp: 60, kind: "projected-growth",  segments: [{ kind: "projected-growth", primary: 60 }] },
    ];
    render(<CalendarChart months={projectedMonths} onSelectMonth={() => {}} primaryCurrency="GBP" />);
    const bars = screen.getAllByTestId("calendar-bar-segment");
    expect(bars.find((b) => b.getAttribute("data-kind") === "projected-cadence")).toBeTruthy();
    expect(bars.find((b) => b.getAttribute("data-kind") === "projected-growth")).toBeTruthy();
  });

  it("renders a ⚠ glyph on growth-clipped segments only", () => {
    const clippedMonths: IncomeCalendarMonth[] = [
      { ym: "2026-09", gbp: 60, kind: "growth-clipped", segments: [{ kind: "growth-clipped", primary: 60 }] },
    ];
    render(<CalendarChart months={clippedMonths} onSelectMonth={() => {}} primaryCurrency="GBP" />);
    expect(screen.getByTestId("growth-clipped-glyph")).toBeInTheDocument();
  });

  it("does NOT render the ⚠ glyph on non-clipped segment kinds", () => {
    const cleanMonths: IncomeCalendarMonth[] = [
      { ym: "2026-08", gbp: 60, kind: "confirmed-forecast", segments: [{ kind: "confirmed-forecast", primary: 60 }] },
    ];
    render(<CalendarChart months={cleanMonths} onSelectMonth={() => {}} primaryCurrency="GBP" />);
    expect(screen.queryByTestId("growth-clipped-glyph")).toBeNull();
  });

  it("tooltip lists per-segment breakdown when a month has multiple segments", () => {
    const mixedMonth: IncomeCalendarMonth = {
      ym: "2026-04",
      gbp: 150,
      kind: "actual",
      segments: [
        { kind: "actual", primary: 100 },
        { kind: "partial", primary: 50 },
      ],
    };
    render(
      <CalendarChart
        months={[mixedMonth]}
        onSelectMonth={() => {}}
        primaryCurrency="GBP"
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("calendar-bar-2026-04"));
    const tooltip = screen.getByTestId("calendar-tooltip");
    expect(tooltip).toHaveTextContent(/Received/);
    expect(tooltip).toHaveTextContent(/Received MTD/);
  });
});

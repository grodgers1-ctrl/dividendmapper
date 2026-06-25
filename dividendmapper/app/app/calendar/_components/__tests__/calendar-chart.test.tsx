import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IncomeCalendarChart } from "../IncomeCalendarChart";
import type { IncomeCalendarMonth } from "@/lib/portfolio/income-calendar";

function fixture(): IncomeCalendarMonth[] {
  return [
    { ym: "2025-12", gbp: 8,  kind: "actual" },
    { ym: "2026-01", gbp: 42, kind: "actual" },
    { ym: "2026-02", gbp: 18, kind: "actual" },
    { ym: "2026-03", gbp: 35, kind: "actual" },
    { ym: "2026-04", gbp: 15, kind: "actual" },
    { ym: "2026-05", gbp: 28, kind: "actual" },
    { ym: "2026-06", gbp: 12, kind: "partial" },
    { ym: "2026-07", gbp: 55, kind: "forecast" },
    { ym: "2026-08", gbp: 18, kind: "forecast" },
    { ym: "2026-09", gbp: 45, kind: "forecast" },
    { ym: "2026-10", gbp: 42, kind: "forecast" },
    { ym: "2026-11", gbp: 20, kind: "forecast" },
  ];
}

describe("IncomeCalendarChart", () => {
  it("renders exactly 12 bars", () => {
    const { container } = render(<IncomeCalendarChart months={fixture()} />);
    const bars = container.querySelectorAll('[data-testid="calendar-bar"]');
    expect(bars).toHaveLength(12);
  });

  it("tags each bar with its kind so opacity styling can target it", () => {
    const { container } = render(<IncomeCalendarChart months={fixture()} />);
    const kinds = Array.from(
      container.querySelectorAll('[data-testid="calendar-bar"]'),
    ).map((b) => b.getAttribute("data-kind"));
    expect(kinds).toEqual([
      "actual","actual","actual","actual","actual","actual",
      "partial",
      "forecast","forecast","forecast","forecast","forecast",
    ]);
  });

  it("renders month labels (3-letter abbreviation)", () => {
    const { getByText } = render(<IncomeCalendarChart months={fixture()} />);
    expect(getByText("Dec")).toBeInTheDocument();
    expect(getByText("Jun")).toBeInTheDocument();
    expect(getByText("Nov")).toBeInTheDocument();
  });

  it("renders a 'today' divider between the current month and the next forecast month", () => {
    const { getByTestId } = render(<IncomeCalendarChart months={fixture()} />);
    expect(getByTestId("today-divider")).toBeInTheDocument();
  });

  it("renders a legend with 'received' and 'forecast' entries", () => {
    const { getByText } = render(<IncomeCalendarChart months={fixture()} />);
    expect(getByText("received")).toBeInTheDocument();
    expect(getByText("forecast")).toBeInTheDocument();
  });

  it("does not crash when every month is zero", () => {
    const flat: IncomeCalendarMonth[] = fixture().map((m) => ({ ...m, gbp: 0 }));
    const { container } = render(<IncomeCalendarChart months={flat} />);
    expect(container.querySelectorAll('[data-testid="calendar-bar"]')).toHaveLength(12);
  });

  it("omits the today divider when no month is partial (off-window edge case)", () => {
    const noPartial: IncomeCalendarMonth[] = fixture().map((m) =>
      m.kind === "partial" ? { ...m, kind: "actual" } : m,
    );
    const { queryByTestId } = render(<IncomeCalendarChart months={noPartial} />);
    expect(queryByTestId("today-divider")).toBeNull();
  });
});

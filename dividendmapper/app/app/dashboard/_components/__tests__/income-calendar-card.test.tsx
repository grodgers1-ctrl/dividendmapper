import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IncomeCalendarCard } from "../IncomeCalendarCard";
import type { IncomeCalendarResult } from "@/lib/portfolio/income-calendar";

function calendarFixture(): IncomeCalendarResult {
  return {
    months: [
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
    ],
    nextThree: [
      { ticker: "PHP.L", exDate: "2026-07-02", payDate: "2026-08-14", gbp: 3.02 },
      { ticker: "ARCC",  exDate: "2026-07-28", payDate: "2026-09-30", gbp: 8.15 },
      { ticker: "TW.L",  exDate: "2026-08-14", payDate: "2026-11-07", gbp: 15.4 },
    ],
  };
}

describe("IncomeCalendarCard", () => {
  it("renders the chart + the next-3 list always", () => {
    const { container, getByText } = render(
      <IncomeCalendarCard calendar={calendarFixture()} reinvestCard={null} />,
    );
    // chart present
    expect(container.querySelectorAll('[data-testid="calendar-bar"]')).toHaveLength(12);
    // next-3 rows present
    expect(getByText("PHP.L")).toBeInTheDocument();
    expect(getByText("ARCC")).toBeInTheDocument();
    expect(getByText("TW.L")).toBeInTheDocument();
  });

  it("omits the reinvest section when reinvestCard is null", () => {
    const { queryByTestId } = render(
      <IncomeCalendarCard calendar={calendarFixture()} reinvestCard={null} />,
    );
    expect(queryByTestId("inline-reinvest")).toBeNull();
  });

  it("renders the inline reinvest section when reinvestCard is provided", () => {
    const reinvestCard = {
      trigger: {
        holdingId: "h1",
        ticker: "PHP.L",
        exDivDate: "2026-07-02",
        payDate: "2026-08-14",
        estPaymentGbp: 3.02,
        currentWeight: 0.07,
      },
      candidates: [
        {
          holdingId: "h2",
          ticker: "ARCC",
          buyScore: 75,
          currentWeight: 0.02,
          diversificationNote: null,
        },
      ],
    };
    const { getByTestId } = render(
      <IncomeCalendarCard
        calendar={calendarFixture()}
        reinvestCard={reinvestCard as never}
      />,
    );
    expect(getByTestId("inline-reinvest")).toBeInTheDocument();
  });

  it("uses the shared card-surface utility class", () => {
    const { container } = render(
      <IncomeCalendarCard calendar={calendarFixture()} reinvestCard={null} />,
    );
    expect(container.firstChild).toHaveClass("card-surface");
  });

  it("formats expected amounts as rounded £ values", () => {
    const { getByText } = render(
      <IncomeCalendarCard calendar={calendarFixture()} reinvestCard={null} />,
    );
    expect(getByText("~£3")).toBeInTheDocument();
    expect(getByText("~£8")).toBeInTheDocument();
    expect(getByText("~£15")).toBeInTheDocument();
  });
});

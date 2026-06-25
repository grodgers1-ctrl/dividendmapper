import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarShell } from "../calendar-shell";
import type { IncomeCalendarResult } from "@/lib/portfolio/income-calendar";

const stubCalendar: IncomeCalendarResult = {
  primaryCurrency: "GBP",
  months: [
    { ym: "2026-06", segments: [{ kind: "partial", primary: 40 }], gbp: 40, kind: "partial" },
    { ym: "2026-07", segments: [{ kind: "confirmed-forecast", primary: 95 }], gbp: 95, kind: "confirmed-forecast" },
  ],
  nextThree: [
    { ticker: "PHP.L", exDate: "2026-07-02", payDate: "2026-07-09", gbp: 42, wrapper: "isa" },
  ],
};

describe("CalendarShell wiring", () => {
  it("clicking a wrapper chip filters the drill-down", () => {
    render(
      <CalendarShell
        locale="uk"
        calendar={stubCalendar}
        userDividends={[]}
        ratesToPrimary={{ GBP: 1, USD: 0.79 }}
        showEmptyStateCta={false}
      />,
    );
    // Default selected month is the partial bucket (2026-06); switch to 2026-07
    // by clicking that bar, then assert PHP.L is in the drill-down.
    fireEvent.click(screen.getByTestId("calendar-bar-2026-07"));
    expect(screen.getByText("PHP.L")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "GIA" }));
    expect(screen.queryByText("PHP.L")).toBeNull();
  });

  it("renders EmptyStateCta when showEmptyStateCta is true", () => {
    render(
      <CalendarShell
        locale="uk"
        calendar={stubCalendar}
        userDividends={[]}
        ratesToPrimary={{ GBP: 1, USD: 0.79 }}
        showEmptyStateCta={true}
      />,
    );
    expect(screen.getByText(/past dividends not showing up/i)).toBeInTheDocument();
  });
});

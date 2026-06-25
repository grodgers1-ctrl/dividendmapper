import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatSidebar } from "../stat-sidebar";

const base = {
  primaryCurrency: "GBP" as const,
  annualIncome: 5420,
  monthlyAverage: 451.67,
  dailyAverage: 14.85,
  yieldOnValue: 0.0338,
  yetToReceive: 291.77,
  includesProjected: false,
};

describe("StatSidebar", () => {
  it("renders the Annual income headline rounded to whole units", () => {
    render(<StatSidebar {...base} />);
    expect(screen.getByTestId("calendar-stat-annual")).toHaveTextContent("£5,420");
  });

  it("renders Monthly / Daily / Yield / Yet-to-receive as a definition list", () => {
    render(<StatSidebar {...base} />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Yield")).toBeInTheDocument();
    expect(screen.getByText("Yet to receive")).toBeInTheDocument();
    expect(screen.getByText("3.38%")).toBeInTheDocument();
  });

  it("shows the 'incl. projected' caveat under Annual income when flagged", () => {
    render(<StatSidebar {...base} includesProjected={true} />);
    expect(screen.getByTestId("calendar-stat-incl-projected")).toBeInTheDocument();
  });

  it("hides the 'incl. projected' caveat when not flagged", () => {
    render(<StatSidebar {...base} includesProjected={false} />);
    expect(screen.queryByTestId("calendar-stat-incl-projected")).toBeNull();
  });

  it("displays a dash for Yield when yieldOnValue is null", () => {
    render(<StatSidebar {...base} yieldOnValue={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses $ formatting when primaryCurrency is USD", () => {
    render(<StatSidebar {...base} primaryCurrency="USD" />);
    expect(screen.getByTestId("calendar-stat-annual")).toHaveTextContent("$5,420");
  });
});

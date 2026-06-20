import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { HeroIncomeCard } from "@/app/app/dashboard/_components/HeroIncomeCard";

afterEach(cleanup);

const sparkline = [
  { at: new Date("2026-01-01"), value: 1000 },
  { at: new Date("2026-06-01"), value: 1200 },
];

describe("HeroIncomeCard", () => {
  it("renders the GBP-formatted headline figure", () => {
    render(<HeroIncomeCard incomeAnnualGbp={1234} sparkline={sparkline} />);
    expect(screen.getByText("£1,234")).toBeTruthy();
  });

  it("renders thousands separators for large totals", () => {
    render(<HeroIncomeCard incomeAnnualGbp={12345} sparkline={sparkline} />);
    expect(screen.getByText("£12,345")).toBeTruthy();
  });

  it("renders the subtitle copy", () => {
    render(<HeroIncomeCard incomeAnnualGbp={1000} sparkline={sparkline} />);
    expect(screen.getByText(/Projected annual dividend income/i)).toBeTruthy();
  });

  it("renders the embedded ridge sparkline svg", () => {
    const { container } = render(
      <HeroIncomeCard incomeAnnualGbp={1000} sparkline={sparkline} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("rounds fractional pence to the nearest pound", () => {
    render(<HeroIncomeCard incomeAnnualGbp={999.51} sparkline={sparkline} />);
    expect(screen.getByText("£1,000")).toBeTruthy();
  });
});

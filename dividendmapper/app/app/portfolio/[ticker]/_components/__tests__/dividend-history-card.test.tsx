import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { DividendHistoryCard } from "@/app/app/portfolio/[ticker]/_components/DividendHistoryCard";

afterEach(cleanup);

const payments = [
  { date: "2026-05-15", amount: 12.5, currency: "USD", kind: "actual" as const },
  { date: "2026-02-15", amount: 11.8, currency: "USD", kind: "actual" as const },
  { date: "2025-11-15", amount: 11.5, currency: "USD", kind: "actual" as const },
];

describe("<DividendHistoryCard>", () => {
  it("renders one row per payment", () => {
    const { container } = render(
      <DividendHistoryCard payments={payments} />,
    );
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  it("formats dates and amounts per payment", () => {
    render(<DividendHistoryCard payments={payments} />);
    expect(screen.getByText(/15 May/i)).toBeInTheDocument();
    expect(screen.getByText(/\$12\.50/)).toBeInTheDocument();
  });

  it("renders an 'Actual' tag for synced rows", () => {
    render(<DividendHistoryCard payments={payments} />);
    expect(screen.getAllByText(/Actual/i).length).toBe(3);
  });

  it("renders an 'Est' tag for forward-calendar rows", () => {
    render(
      <DividendHistoryCard
        payments={[
          {
            date: "2026-07-15",
            amount: 12.5,
            currency: "USD",
            kind: "estimate",
          },
        ]}
      />,
    );
    expect(screen.getByText(/Est/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no payments", () => {
    render(<DividendHistoryCard payments={[]} />);
    expect(screen.getByText(/no dividend history/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ReinvestStripCard } from "@/app/app/dashboard/_components/ReinvestStripCard";
import type { ReinvestCard as ReinvestCardData } from "@/lib/reinvest/build-card";

vi.mock("@/app/app/portfolio/_components/reinvest-card", () => ({
  ReinvestCard: ({ trigger }: { trigger: { ticker: string } }) => (
    <div data-testid="reinvest-card">{trigger.ticker}</div>
  ),
}));

afterEach(cleanup);

function dummyCard(): ReinvestCardData {
  return {
    trigger: {
      ticker: "AAPL",
      payDate: "2026-06-25",
      amountGbp: 42,
      wrapper: "isa",
    },
    candidates: [],
  } as unknown as ReinvestCardData;
}

describe("<ReinvestStripCard>", () => {
  it("renders the wrapped ReinvestCard when a payment is imminent", () => {
    render(<ReinvestStripCard reinvestCard={dummyCard()} />);
    expect(screen.getByTestId("reinvest-card")).toHaveTextContent("AAPL");
  });

  it("renders an empty state when no payment is imminent", () => {
    render(<ReinvestStripCard reinvestCard={null} />);
    expect(screen.queryByTestId("reinvest-card")).toBeNull();
    expect(screen.getByText(/no upcoming dividends/i)).toBeInTheDocument();
  });
});

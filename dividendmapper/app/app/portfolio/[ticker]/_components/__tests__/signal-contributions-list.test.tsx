import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { SignalContributionsList } from "@/app/app/portfolio/[ticker]/_components/SignalContributionsList";

afterEach(cleanup);

const signals = [
  { signalCode: "A1", humanLabel: "Yield in 5y percentile", contribution: 12.5, weight: 0.2 },
  { signalCode: "A2", humanLabel: "P/E vs 5y history", contribution: -4.0, weight: 0.15 },
  { signalCode: "A3", humanLabel: "DCF gap", contribution: 7.2, weight: 0.18 },
];

describe("<SignalContributionsList>", () => {
  it("renders one row per signal", () => {
    const { container } = render(
      <SignalContributionsList signals={signals} title="Quality signals" />,
    );
    expect(container.querySelectorAll("[data-testid='signal-row']").length).toBe(3);
  });

  it("renders the signal code and human label", () => {
    render(<SignalContributionsList signals={signals} title="Quality signals" />);
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("Yield in 5y percentile")).toBeInTheDocument();
  });

  it("renders signed contribution numbers", () => {
    render(<SignalContributionsList signals={signals} title="Quality signals" />);
    expect(screen.getByText("+12.5")).toBeInTheDocument();
    expect(screen.getByText("−4.0")).toBeInTheDocument();
    expect(screen.getByText("+7.2")).toBeInTheDocument();
  });

  it("renders the title heading", () => {
    render(<SignalContributionsList signals={signals} title="Quality signals" />);
    expect(screen.getByText("Quality signals")).toBeInTheDocument();
  });

  it("renders an empty state when there are no signals", () => {
    render(<SignalContributionsList signals={[]} title="Quality signals" />);
    expect(screen.getByText(/no signals/i)).toBeInTheDocument();
  });
});

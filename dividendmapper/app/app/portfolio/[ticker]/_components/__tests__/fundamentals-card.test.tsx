import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { FundamentalsCard } from "@/app/app/portfolio/[ticker]/_components/FundamentalsCard";

afterEach(cleanup);

describe("<FundamentalsCard>", () => {
  it("renders the P/E and yield rows when supplied", () => {
    render(
      <FundamentalsCard
        pe={28.5}
        forwardPe={26.1}
        payoutRatio={0.45}
        netDebtToEbitda={1.2}
        fcfCoverage={1.8}
        currentYield={0.034}
        dividendCagr5y={0.061}
        sector="Information Technology"
      />,
    );
    expect(screen.getByText("P/E")).toBeInTheDocument();
    expect(screen.getByText("Forward P/E")).toBeInTheDocument();
    expect(screen.getByText("28.5x")).toBeInTheDocument();
    expect(screen.getByText("26.1x")).toBeInTheDocument();
    expect(screen.getByText("Yield")).toBeInTheDocument();
    expect(screen.getByText("3.4%")).toBeInTheDocument();
  });

  it("renders the FMP attribution footnote", () => {
    render(
      <FundamentalsCard
        pe={null}
        forwardPe={null}
        payoutRatio={null}
        netDebtToEbitda={null}
        fcfCoverage={null}
        currentYield={null}
        dividendCagr5y={null}
        sector={null}
      />,
    );
    expect(screen.getByText(/refreshed nightly/i)).toBeInTheDocument();
  });

  it("renders dash placeholders for missing rows", () => {
    render(
      <FundamentalsCard
        pe={null}
        forwardPe={null}
        payoutRatio={null}
        netDebtToEbitda={null}
        fcfCoverage={null}
        currentYield={null}
        dividendCagr5y={null}
        sector={null}
      />,
    );
    // Each row should render a — placeholder for missing values
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(6);
  });

  it("shows the sector when supplied", () => {
    render(
      <FundamentalsCard
        pe={null}
        forwardPe={null}
        payoutRatio={null}
        netDebtToEbitda={null}
        fcfCoverage={null}
        currentYield={null}
        dividendCagr5y={null}
        sector="Consumer Staples"
      />,
    );
    expect(screen.getByText("Consumer Staples")).toBeInTheDocument();
  });
});

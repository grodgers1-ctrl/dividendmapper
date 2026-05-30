import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioSummaryBanner } from "../portfolio-summary-banner";

describe("<PortfolioSummaryBanner>", () => {
  it("lists flagged tickers grouped by hint", () => {
    render(
      <PortfolioSummaryBanner
        flagged={[
          { ticker: "PEP", hint: "Consider trimming" },
          { ticker: "PYPL", hint: "Consider trimming" },
          { ticker: "SCHD", hint: "Review urgently" },
        ]}
      />,
    );
    expect(screen.getByText(/PEP/)).toBeInTheDocument();
    expect(screen.getByText(/PYPL/)).toBeInTheDocument();
    expect(screen.getByText(/Consider trimming/)).toBeInTheDocument();
    expect(screen.getByText(/Review urgently/)).toBeInTheDocument();
  });

  it("renders nothing when there are no flagged holdings", () => {
    const { container } = render(<PortfolioSummaryBanner flagged={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    render(<PortfolioSummaryBanner flagged={[{ ticker: "PEP", hint: "Review urgently" }]} />);
    expect(screen.getByText(/PEP/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/PEP/)).not.toBeInTheDocument();
  });

  it("links to the full scores page", () => {
    render(<PortfolioSummaryBanner flagged={[{ ticker: "PEP", hint: "Review urgently" }]} />);
    expect(screen.getByRole("link", { name: /view all scores/i })).toHaveAttribute(
      "href",
      "/app/portfolio/scoring",
    );
  });
});

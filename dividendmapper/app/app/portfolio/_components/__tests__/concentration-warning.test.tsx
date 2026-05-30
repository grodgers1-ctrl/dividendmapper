import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConcentrationWarning } from "../concentration-warning";

describe("<ConcentrationWarning>", () => {
  it("renders nothing when overweight list is empty", () => {
    const { container } = render(
      <ConcentrationWarning overweight={[]} threshold={0.2} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the heading and ticker + percentage for a single overweight holding", () => {
    render(
      <ConcentrationWarning
        overweight={[{ ticker: "AAPL", weight: 0.7 }]}
        threshold={0.2}
      />,
    );
    expect(
      screen.getByRole("status"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Concentration check/i)).toBeInTheDocument();
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText(/20%/)).toBeInTheDocument();
  });

  it("renders multiple overweight tickers and each percentage", () => {
    render(
      <ConcentrationWarning
        overweight={[
          { ticker: "AAPL", weight: 0.6 },
          { ticker: "MSFT", weight: 0.3 },
        ]}
        threshold={0.2}
      />,
    );
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it("reflects the configured threshold in the copy", () => {
    render(
      <ConcentrationWarning
        overweight={[{ ticker: "VOD.L", weight: 0.4 }]}
        threshold={0.33}
      />,
    );
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });

  it("does not imply a buy or sell action", () => {
    render(
      <ConcentrationWarning
        overweight={[{ ticker: "SCHD", weight: 0.5 }]}
        threshold={0.2}
      />,
    );
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).not.toMatch(/buy|sell|purchase|reduce/i);
  });
});

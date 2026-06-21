import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ResilienceCard } from "@/app/app/portfolio/[ticker]/_components/ResilienceCard";

afterEach(cleanup);

describe("<ResilienceCard>", () => {
  it("renders the score orb gauge with the ticker", () => {
    const { container } = render(
      <ResilienceCard
        ticker="AAPL"
        quality={72}
        trim={28}
        risk={35}
        qualityGateReason={null}
        isBeta={false}
      />,
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("renders the three score chips with values", () => {
    render(
      <ResilienceCard
        ticker="AAPL"
        quality={72}
        trim={28}
        risk={35}
        qualityGateReason={null}
        isBeta={false}
      />,
    );
    expect(screen.getByText(/Quality\s*72/)).toBeInTheDocument();
    expect(screen.getByText(/Trim\s*28/)).toBeInTheDocument();
    expect(screen.getByText(/Risk\s*35/)).toBeInTheDocument();
  });

  it("links to the public methodology page for the ticker", () => {
    render(
      <ResilienceCard
        ticker="AAPL"
        quality={72}
        trim={28}
        risk={35}
        qualityGateReason={null}
        isBeta={false}
      />,
    );
    const link = screen.getByRole("link", { name: /public methodology/i });
    expect(link.getAttribute("href")).toBe("/scoring/AAPL");
  });

  it("shows a collecting state when no score is available", () => {
    render(
      <ResilienceCard
        ticker="NEW.L"
        quality={null}
        trim={null}
        risk={null}
        qualityGateReason={null}
        isBeta={false}
      />,
    );
    expect(screen.getByText(/scores collecting/i)).toBeInTheDocument();
  });
});

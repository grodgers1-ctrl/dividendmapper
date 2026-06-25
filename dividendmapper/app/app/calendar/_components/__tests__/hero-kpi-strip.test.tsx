import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroKpiStrip } from "../hero-kpi-strip";

describe("HeroKpiStrip", () => {
  it("renders the four tiles with correct values in the primary currency", () => {
    render(
      <HeroKpiStrip
        primaryCurrency="GBP"
        next7Days={42}
        next30Days={178}
        ytdReceived={1234}
        last12mReceived={4567}
        includesProjected={false}
      />,
    );
    expect(screen.getByLabelText(/next 7 days/i)).toHaveTextContent("£42");
    expect(screen.getByLabelText(/next 30 days/i)).toHaveTextContent("£178");
    expect(screen.getByLabelText(/ytd received/i)).toHaveTextContent("£1,234");
    expect(screen.getByLabelText(/last 12 months received/i)).toHaveTextContent("£4,567");
  });

  it("uses $ when primaryCurrency is USD", () => {
    render(
      <HeroKpiStrip
        primaryCurrency="USD"
        next7Days={42}
        next30Days={178}
        ytdReceived={1234}
        last12mReceived={4567}
        includesProjected={false}
      />,
    );
    expect(screen.getByLabelText(/next 7 days/i)).toHaveTextContent("$42");
  });

  it("renders the includes-projected footnote tooltip when applicable", () => {
    render(
      <HeroKpiStrip
        primaryCurrency="GBP"
        next7Days={42}
        next30Days={178}
        ytdReceived={1234}
        last12mReceived={4567}
        includesProjected
      />,
    );
    expect(screen.getByText(/incl\. projected/i)).toBeInTheDocument();
  });
});

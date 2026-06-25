import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DividendCalendarLanding from "../page";

describe("/dividend-calendar landing", () => {
  it("renders the hero headline and CTAs", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByText(/know exactly when every dividend lands/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see it with your portfolio/i })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("renders the demo calendar component", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByTestId("demo-calendar")).toBeInTheDocument();
  });

  it("renders the three feature panels", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByText(/projected, not just confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/every dividend in one place/i)).toBeInTheDocument();
    expect(screen.getByText(/tax-wrapper-aware/i)).toBeInTheDocument();
  });

  it("renders the FAQ section", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByText(/how do projections work/i)).toBeInTheDocument();
    expect(screen.getByText(/why do you cap growth at ±20%/i)).toBeInTheDocument();
  });
});

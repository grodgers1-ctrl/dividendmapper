import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateCta } from "../empty-state-cta";

describe("EmptyStateCta", () => {
  it("renders the two CTA buttons", () => {
    render(<EmptyStateCta />);
    expect(screen.getByRole("link", { name: /connect broker/i })).toHaveAttribute(
      "href",
      "/app/account/brokers",
    );
    expect(screen.getByRole("button", { name: /import csv/i })).toBeInTheDocument();
  });

  it("renders the headline and body copy", () => {
    render(<EmptyStateCta />);
    expect(screen.getByText(/past dividends not showing up/i)).toBeInTheDocument();
    expect(screen.getByText(/connect trading 212/i)).toBeInTheDocument();
  });
});

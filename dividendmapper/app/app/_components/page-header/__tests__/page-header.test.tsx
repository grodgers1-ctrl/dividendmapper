import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../page-header";

describe("<PageHeader>", () => {
  it("renders the title as an h1", () => {
    render(<PageHeader title="Your portfolio" />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Your portfolio",
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(
      <PageHeader title="Portfolio Manager" subtitle="Quality, Trim and Risk." />,
    );
    expect(
      screen.getByText("Quality, Trim and Risk."),
    ).toBeInTheDocument();
  });

  it("omits the subtitle element when not provided", () => {
    render(<PageHeader title="Account" />);
    // No paragraph elements should sit alongside the title.
    expect(screen.queryByRole("paragraph")).toBeNull();
  });

  it("renders the actions slot when provided", () => {
    render(
      <PageHeader
        title="Your portfolio"
        actions={<button type="button">Add holding</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Add holding" }),
    ).toBeInTheDocument();
  });

  it("does not render a betaPill when betaPill is false/unset", () => {
    render(<PageHeader title="Account" />);
    expect(screen.queryByText(/scoring.*beta/i)).toBeNull();
  });

  it("renders the BetaPill when betaPill is true (Day 8 wired the real <BetaPill>)", () => {
    render(<PageHeader title="Portfolio Manager" betaPill />);
    expect(screen.getByText(/scoring.*beta/i)).toBeInTheDocument();
  });

  it("renders the React-node subtitle if provided (e.g. dynamic ${count} interpolation)", () => {
    render(
      <PageHeader
        title="Your portfolio"
        subtitle={<>{5} holdings · Pro · unlimited</>}
      />,
    );
    expect(screen.getByText(/5 holdings/)).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelatedLinks } from "../related-links";

describe("<RelatedLinks>", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<RelatedLinks items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a default heading when no title is provided", () => {
    render(
      <RelatedLinks
        items={[
          { href: "/blog/dividend-tracker-guide-uk-income-investors", label: "Tracker guide" },
        ]}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(/where to next/i);
  });

  it("renders a custom title when provided", () => {
    render(
      <RelatedLinks
        title="Choose your next step"
        items={[{ href: "/tools/retirement-calculator", label: "Retirement calculator" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: /choose your next step/i })).toBeInTheDocument();
  });

  it("renders each item as a link with the correct href and label", () => {
    render(
      <RelatedLinks
        items={[
          { href: "/blog/dividend-tracker-guide-uk-income-investors", label: "What a dividend tracker actually is" },
          { href: "/blog/sharesight-vs-dividendmapper-uk-income-investors", label: "Sharesight comparison" },
          { href: "/tools/retirement-calculator", label: "Project your retirement income" },
        ]}
      />,
    );

    const trackerLink = screen.getByRole("link", { name: /what a dividend tracker actually is/i });
    expect(trackerLink).toHaveAttribute("href", "/blog/dividend-tracker-guide-uk-income-investors");

    const sharesightLink = screen.getByRole("link", { name: /sharesight comparison/i });
    expect(sharesightLink).toHaveAttribute("href", "/blog/sharesight-vs-dividendmapper-uk-income-investors");

    const retirementLink = screen.getByRole("link", { name: /project your retirement income/i });
    expect(retirementLink).toHaveAttribute("href", "/tools/retirement-calculator");
  });

  it("renders an item description when provided", () => {
    render(
      <RelatedLinks
        items={[
          {
            href: "/blog/dividend-tracker-guide-uk-income-investors",
            label: "Tracker guide",
            description: "What tracking means for a UK income investor.",
          },
        ]}
      />,
    );
    expect(screen.getByText(/what tracking means for a uk income investor\./i)).toBeInTheDocument();
  });

  it("renders without a description when none is provided", () => {
    render(
      <RelatedLinks
        items={[
          { href: "/tools/dcf-calculator", label: "DCF calculator" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /dcf calculator/i })).toBeInTheDocument();
  });
});

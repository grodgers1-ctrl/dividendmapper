import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortfolioSubNav } from "../portfolio-subnav";

const mockPath = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => mockPath() }));

describe("<PortfolioSubNav>", () => {
  it("renders Ledger and Manager links", () => {
    mockPath.mockReturnValue("/app/portfolio");
    render(<PortfolioSubNav />);
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute(
      "href",
      "/app/portfolio",
    );
    expect(screen.getByRole("link", { name: "Portfolio Manager" })).toHaveAttribute(
      "href",
      "/app/portfolio/scoring",
    );
  });

  it("marks Ledger active on the ledger path", () => {
    mockPath.mockReturnValue("/app/portfolio");
    render(<PortfolioSubNav />);
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Portfolio Manager" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Manager active on the scoring path", () => {
    mockPath.mockReturnValue("/app/portfolio/scoring");
    render(<PortfolioSubNav />);
    expect(
      screen.getByRole("link", { name: "Portfolio Manager" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ledger" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

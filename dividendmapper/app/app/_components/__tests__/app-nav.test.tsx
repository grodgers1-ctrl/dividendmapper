import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppNav } from "../app-nav";

const mockPath = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => mockPath() }));

describe("<AppNav>", () => {
  it("renders Ledger, Portfolio Manager and Account tabs", () => {
    mockPath.mockReturnValue("/app/portfolio");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute(
      "href",
      "/app/portfolio",
    );
    expect(screen.getByRole("link", { name: "Portfolio Manager" })).toHaveAttribute(
      "href",
      "/app/portfolio/scoring",
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/app/account",
    );
  });

  it("marks only Ledger active on the ledger path (not Portfolio Manager)", () => {
    mockPath.mockReturnValue("/app/portfolio");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Portfolio Manager" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks only Portfolio Manager active on the scoring path (not Ledger)", () => {
    mockPath.mockReturnValue("/app/portfolio/scoring");
    render(<AppNav />);
    expect(
      screen.getByRole("link", { name: "Portfolio Manager" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ledger" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Account active on account sub-paths", () => {
    mockPath.mockReturnValue("/app/account/notifications");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
